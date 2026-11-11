import logging
import queue
import threading
from typing import Optional

from app.core.database import SyncSessionLocal
from app.ml.pipeline import train_model
from app.models.models import TrainingJob

logger = logging.getLogger("training_worker")


class TrainingWorker:
    """
    Background worker that executes model training jobs sequentially in a separate thread.
    Uses synchronous database sessions and provides thread-safe job submission and cancellation.
    """

    def __init__(self):
        self._queue: queue.Queue[int] = queue.Queue()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._cancel_events: dict[int, threading.Event] = {}
        self._current_job_id: Optional[int] = None
        self._lock = threading.Lock()

    def start(self) -> None:
        """Starts the worker thread."""
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._thread = threading.Thread(
                target=self._worker_loop,
                name="HAR-TrainingWorker",
                daemon=True,
            )
            self._thread.start()
            logger.info("Training worker thread started.")

    def stop(self) -> None:
        """Signals the worker to terminate gracefully."""
        self._stop_event.set()
        # Wake up the queue get if waiting
        self._queue.put(-1)
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        logger.info("Training worker stopped.")

    def submit_job(self, job_id: int) -> None:
        """Enqueues a new training job."""
        with self._lock:
            self._cancel_events[job_id] = threading.Event()
        self._queue.put(job_id)
        logger.info(f"Job #{job_id} submitted to training queue.")

    def cancel_job(self, job_id: int) -> bool:
        """
        Cancels a running or queued job.
        Returns True if the cancellation signal was sent.
        """
        with self._lock:
            if job_id in self._cancel_events:
                self._cancel_events[job_id].set()

            # If it's the currently running job
            if self._current_job_id == job_id:
                logger.info(f"Cancellation signal sent to running job #{job_id}.")
                return True

        # If job is in queued state in database, mark it as cancelled directly
        session = SyncSessionLocal()
        try:
            job = session.query(TrainingJob).filter(TrainingJob.id == job_id).first()
            if job and job.status == "queued":
                job.status = "cancelled"
                session.commit()
                logger.info(f"Queued job #{job_id} marked as cancelled in DB.")
                return True
        except Exception as e:
            logger.error(f"Error updating cancelled job #{job_id}: {e}")
        finally:
            session.close()

        return False

    def is_job_active(self, job_id: int) -> bool:
        """Checks if a job is currently executing."""
        with self._lock:
            return self._current_job_id == job_id

    def _worker_loop(self) -> None:
        """Main execution loop running in background thread."""
        while not self._stop_event.is_set():
            try:
                job_id = self._queue.get(timeout=1.0)
            except queue.Empty:
                continue

            if job_id == -1 or self._stop_event.is_set():
                break

            with self._lock:
                self._current_job_id = job_id
                cancel_event = self._cancel_events.get(job_id)

            try:
                self._process_job(job_id, cancel_event)
            except Exception as e:
                logger.error(f"Unhandled error in training job #{job_id}: {e}", exc_info=True)
            finally:
                with self._lock:
                    self._current_job_id = None
                    if job_id in self._cancel_events:
                        del self._cancel_events[job_id]
                self._queue.task_done()

    def _process_job(self, job_id: int, cancel_event: Optional[threading.Event]) -> None:
        """Loads job configuration from DB and invokes PyTorch training pipeline."""
        session = SyncSessionLocal()
        try:
            job = session.query(TrainingJob).filter(TrainingJob.id == job_id).first()
            if not job:
                logger.warning(f"Job #{job_id} not found in database. Skipping.")
                return

            if job.status == "cancelled":
                logger.info(f"Job #{job_id} was cancelled before execution. Skipping.")
                return

            config = dict(job.config) if job.config else {}
        finally:
            session.close()

        # Run training pipeline
        logger.info(f"Starting training pipeline for job #{job_id}...")
        train_model(
            job_id=job_id,
            db_session_factory=SyncSessionLocal,
            config_dict=config,
            cancel_event=cancel_event,
        )
        logger.info(f"Finished training pipeline for job #{job_id}.")


# Global singleton instance
training_worker = TrainingWorker()


def start_worker() -> None:
    """Helper to start the global training worker."""
    training_worker.start()


def stop_worker() -> None:
    """Helper to stop the global training worker."""
    training_worker.stop()


def submit_job(job_id: int) -> None:
    """Helper to submit a job to the global training worker."""
    training_worker.submit_job(job_id)


def cancel_job(job_id: int) -> bool:
    """Helper to cancel a job in the global training worker."""
    return training_worker.cancel_job(job_id)
