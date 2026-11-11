import copy
from datetime import datetime
import os
from pathlib import Path
import threading
import time
import traceback
from typing import Any, Optional
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
import torch
import torch.nn as nn
from torchvision.models.video import R3D_18_Weights, r3d_18

from app.core.config import settings
from app.ml.dataset_loader import create_data_loaders
from app.models.models import Dataset, DatasetClass, MLModel, TrainingJob, TrainingMetric


def create_model(
    architecture: str = "r3d_18",
    num_classes: int = 2,
    fine_tune_strategy: str = "partial",
    pretrained: bool = True,
) -> nn.Module:
    """
    Instantiates a 3D CNN model, replaces classification head,
    and configures parameter freezing based on fine-tuning strategy.
    """
    if architecture.lower() != "r3d_18":
        raise ValueError(f"Architecture '{architecture}' is not supported. Use 'r3d_18'.")

    if pretrained:
        try:
            model = r3d_18(weights=R3D_18_Weights.DEFAULT)
        except Exception:
            # Fallback if weights cannot be downloaded
            model = r3d_18(weights=None)
    else:
        model = r3d_18(weights=None)

    # Replace final fully-connected layer
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, num_classes)

    # Apply fine-tuning freezing strategies
    strategy = fine_tune_strategy.lower()
    if strategy == "head_only":
        for param in model.parameters():
            param.requires_grad = False
        for param in model.fc.parameters():
            param.requires_grad = True
    elif strategy == "partial":
        # Freeze stem and layer1, layer2; unfreeze layer3, layer4, and fc
        for param in model.parameters():
            param.requires_grad = False
        for layer in [model.layer3, model.layer4, model.fc]:
            for param in layer.parameters():
                param.requires_grad = True
    elif strategy == "full":
        # Fine-tune all layers
        for param in model.parameters():
            param.requires_grad = True
    else:
        # Default to partial
        for param in model.parameters():
            param.requires_grad = False
        for layer in [model.layer3, model.layer4, model.fc]:
            for param in layer.parameters():
                param.requires_grad = True

    return model


def evaluate_model(
    model: nn.Module,
    data_loader: torch.utils.data.DataLoader,
    device: str,
    classes: list[str],
) -> dict[str, Any]:
    """
    Evaluates a model over a dataset and calculates accuracy, per-class metrics,
    and confusion matrix.
    """
    model.eval()
    all_preds: list[int] = []
    all_targets: list[int] = []
    total_loss = 0.0
    criterion = nn.CrossEntropyLoss()
    total_samples = 0

    with torch.no_grad():
        for batch_videos, batch_labels in data_loader:
            if batch_videos is None or batch_labels is None:
                continue

            batch_videos = batch_videos.to(device)
            batch_labels = batch_labels.to(device)

            outputs = model(batch_videos)
            loss = criterion(outputs, batch_labels)

            total_loss += loss.item() * batch_videos.size(0)
            preds = torch.argmax(outputs, dim=1).cpu().numpy()
            targets = batch_labels.cpu().numpy()

            all_preds.extend(preds.tolist())
            all_targets.extend(targets.tolist())
            total_samples += batch_videos.size(0)

    if total_samples == 0:
        return {
            "loss": 0.0,
            "accuracy": 0.0,
            "classification_report": {},
            "confusion_matrix": [],
        }

    avg_loss = total_loss / total_samples
    accuracy = float(np.mean(np.array(all_preds) == np.array(all_targets)))

    # Classification report & confusion matrix
    target_names = [classes[i] if i < len(classes) else str(i) for i in sorted(list(set(all_targets + all_preds)))]
    try:
        clf_rep = classification_report(
            all_targets, all_preds, target_names=target_names, output_dict=True, zero_division=0
        )
    except Exception:
        clf_rep = {}

    try:
        conf_mat = confusion_matrix(all_targets, all_preds).tolist()
    except Exception:
        conf_mat = []

    return {
        "loss": round(avg_loss, 4),
        "accuracy": round(accuracy * 100.0, 2),
        "classification_report": clf_rep,
        "confusion_matrix": conf_mat,
    }


def train_model(
    job_id: int,
    db_session_factory,
    config_dict: dict[str, Any],
    cancel_event: Optional[threading.Event] = None,
) -> dict[str, Any]:
    """
    Executes the training loop synchronously for a given job ID.
    Tracks epoch progress, updates database, handles early stopping,
    saves checkpoints, and registers the final trained MLModel.
    """
    session = db_session_factory()
    try:
        job = session.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            raise ValueError(f"TrainingJob #{job_id} not found in database.")

        # Update status to preparing
        job.status = "preparing"
        job.started_at = datetime.utcnow()
        session.commit()

        # Load Dataset and classes
        dataset = session.query(Dataset).filter(Dataset.id == job.dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset #{job.dataset_id} not found.")

        dataset_classes = (
            session.query(DatasetClass)
            .filter(DatasetClass.dataset_id == job.dataset_id)
            .order_by(DatasetClass.class_index)
            .all()
        )
        classes = [dc.name for dc in dataset_classes]
        if len(classes) < 2:
            raise ValueError(f"Dataset #{dataset.id} has only {len(classes)} classes. Minimum 2 required.")

        # Hardware & device selection
        device_str = "cuda" if torch.cuda.is_available() else "cpu"
        job.device = (
            f"{torch.cuda.get_device_name(0)} (CUDA)"
            if device_str == "cuda"
            else "CPU"
        )
        session.commit()

        # Build data loaders
        train_loader, val_loader, test_loader, class_to_idx = create_data_loaders(
            dataset_path=dataset.storage_path,
            classes=classes,
            config=config_dict,
        )

        # Build model
        architecture = config_dict.get("architecture", "r3d_18")
        strategy = config_dict.get("fine_tune_strategy", "partial")
        model = create_model(
            architecture=architecture,
            num_classes=len(classes),
            fine_tune_strategy=strategy,
            pretrained=True,
        )
        model = model.to(device_str)

        # Hyperparameters
        epochs = int(config_dict.get("epochs", settings.DEFAULT_EPOCHS))
        job.total_epochs = epochs
        lr = float(config_dict.get("learning_rate", settings.DEFAULT_LEARNING_RATE))
        optimizer_name = str(config_dict.get("optimizer", "adam")).lower()
        scheduler_name = str(config_dict.get("scheduler", "cosine")).lower()
        patience = int(config_dict.get("patience", 5))
        amp_enabled = bool(config_dict.get("amp", True)) and (device_str == "cuda")

        # Optimizer
        trainable_params = [p for p in model.parameters() if p.requires_grad]
        if optimizer_name == "sgd":
            optimizer = torch.optim.SGD(trainable_params, lr=lr, momentum=0.9, weight_decay=1e-4)
        elif optimizer_name == "adamw":
            optimizer = torch.optim.AdamW(trainable_params, lr=lr, weight_decay=1e-2)
        else:
            optimizer = torch.optim.Adam(trainable_params, lr=lr, weight_decay=1e-4)

        # Scheduler
        if scheduler_name == "step":
            scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=max(epochs // 3, 1), gamma=0.5)
        elif scheduler_name == "cosine":
            scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
        else:
            scheduler = None

        criterion = nn.CrossEntropyLoss()
        scaler = torch.amp.GradScaler("cuda", enabled=amp_enabled)

        # Transition to training
        job.status = "training"
        session.commit()

        best_val_acc = 0.0
        best_val_loss = float("inf")
        best_model_weights = copy.deepcopy(model.state_dict())
        patience_counter = 0

        for epoch in range(1, epochs + 1):
            epoch_start_time = time.time()

            # Check for cancellation signal
            if cancel_event and cancel_event.is_set():
                job.status = "cancelled"
                session.commit()
                return {"status": "cancelled", "epoch": epoch - 1}

            # ----------------- Training Step -----------------
            model.train()
            train_running_loss = 0.0
            train_correct = 0
            train_total = 0

            for batch_videos, batch_labels in train_loader:
                if batch_videos is None or batch_labels is None:
                    continue

                batch_videos = batch_videos.to(device_str)
                batch_labels = batch_labels.to(device_str)

                optimizer.zero_grad()

                with torch.amp.autocast("cuda", enabled=amp_enabled):
                    outputs = model(batch_videos)
                    loss = criterion(outputs, batch_labels)

                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()

                train_running_loss += loss.item() * batch_videos.size(0)
                preds = torch.argmax(outputs, dim=1)
                train_correct += (preds == batch_labels).sum().item()
                train_total += batch_videos.size(0)

            train_loss = (train_running_loss / train_total) if train_total > 0 else 0.0
            train_acc = (train_correct / train_total * 100.0) if train_total > 0 else 0.0

            # ----------------- Validation Step -----------------
            val_eval = evaluate_model(model, val_loader, device_str, classes)
            val_loss = val_eval["loss"]
            val_acc = val_eval["accuracy"]

            if scheduler is not None:
                scheduler.step()

            current_lr = float(optimizer.param_groups[0]["lr"])
            epoch_time = round(time.time() - epoch_start_time, 2)

            # Record metric
            metric = TrainingMetric(
                job_id=job.id,
                epoch=epoch,
                train_loss=round(train_loss, 4),
                val_loss=val_loss,
                val_accuracy=val_acc,
                learning_rate=current_lr,
                epoch_time=epoch_time,
            )
            session.add(metric)

            # Update job state
            job.current_epoch = epoch
            job.train_loss = round(train_loss, 4)
            job.val_loss = val_loss
            job.val_accuracy = val_acc
            job.learning_rate = current_lr

            if val_acc > best_val_acc or epoch == 1:
                best_val_acc = val_acc
                job.best_val_accuracy = best_val_acc
                best_model_weights = copy.deepcopy(model.state_dict())

            session.commit()

            # Early stopping check
            if val_loss < best_val_loss - 1e-4:
                best_val_loss = val_loss
                patience_counter = 0
            else:
                patience_counter += 1
                if patience > 0 and patience_counter >= patience and epoch >= 5:
                    break

        # ----------------- Final Evaluation & Checkpointing -----------------
        job.status = "validating"
        session.commit()

        # Load best weights
        model.load_state_dict(best_model_weights)

        # Test evaluation
        eval_loader = test_loader if test_loader is not None else val_loader
        final_eval = evaluate_model(model, eval_loader, device_str, classes)
        final_accuracy = final_eval["accuracy"]

        # Save model artifact
        model_filename = f"model_job_{job.id}_{int(time.time())}.pth"
        model_save_path = settings.MODELS_DIR / model_filename

        torch.save(
            {
                "model_state_dict": best_model_weights,
                "classes": classes,
                "num_classes": len(classes),
                "architecture": architecture,
                "config": config_dict,
                "val_accuracy": best_val_acc,
                "test_accuracy": final_accuracy,
            },
            model_save_path,
        )

        file_size = os.path.getsize(model_save_path)

        # Create MLModel entry
        ml_model = MLModel(
            name=f"{job.name} ({architecture})",
            job_id=job.id,
            dataset_id=job.dataset_id,
            architecture=architecture,
            num_classes=len(classes),
            classes=classes,
            accuracy=final_accuracy,
            model_path=str(model_save_path.resolve()),
            config=config_dict,
            file_size=file_size,
        )
        session.add(ml_model)

        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.model_path = str(model_save_path.resolve())
        session.commit()

        return {
            "status": "completed",
            "model_id": ml_model.id,
            "accuracy": final_accuracy,
            "best_val_accuracy": best_val_acc,
        }

    except Exception as exc:
        session.rollback()
        error_details = traceback.format_exc()
        try:
            job = session.query(TrainingJob).filter(TrainingJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = f"{str(exc)}\n\n{error_details}"
                job.completed_at = datetime.utcnow()
                session.commit()
        except Exception:
            pass
        raise
    finally:
        session.close()
