import axios, { AxiosProgressEvent } from 'axios';
import {
  Dataset,
  DatasetDetail,
  ValidationReport,
  TrainingConfig,
  TrainingJob,
  TrainingJobDetail,
  MLModel,
  AnalysisResult,
  EnsembleAnalysisResult,
  DashboardStats,
  GPUInfo,
} from '../types';

const api = axios.create({
  baseURL: 'http://localhost:8001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred';
    const detail = error.response?.data?.detail;

    if (Array.isArray(detail)) {
      // Pydantic validation error: list of { loc, msg, type } objects
      message = detail.map((d: any) => `${d.loc ? d.loc.slice(1).join('.') + ': ' : ''}${d.msg || JSON.stringify(d)}`).join('; ');
    } else if (typeof detail === 'string') {
      message = detail;
    } else if (error.response?.data?.message) {
      message = error.response.data.message;
    } else if (error.message) {
      message = error.message;
    }

    return Promise.reject(new Error(message));
  }
);

// --- Dashboard ---
export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<DashboardStats>('/dashboard/stats');
  return res.data;
}

// --- Datasets ---
export async function getDatasets(): Promise<Dataset[]> {
  const res = await api.get<Dataset[]>('/datasets');
  return res.data;
}

export async function getDataset(id: number): Promise<DatasetDetail> {
  const res = await api.get<DatasetDetail>(`/datasets/${id}`);
  return res.data;
}

export async function uploadDatasetZip(
  file: File,
  name: string,
  description: string,
  onProgress?: (pct: number) => void
): Promise<Dataset> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('description', description);

  const res = await api.post<Dataset>('/datasets/upload-zip', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });
  return res.data;
}

export async function uploadDatasetVideos(
  files: File[],
  name: string,
  description: string,
  labels: string[],
  onProgress?: (pct: number) => void
): Promise<Dataset> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('name', name);
  formData.append('description', description);
  formData.append('labels', labels.join(','));

  const res = await api.post<Dataset>('/datasets/upload-videos', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });
  return res.data;
}

export async function deleteDataset(id: number): Promise<void> {
  await api.delete(`/datasets/${id}`);
}

export async function validateDataset(id: number): Promise<ValidationReport> {
  const res = await api.post<ValidationReport>(`/datasets/${id}/validate`);
  return res.data;
}

export async function remapClasses(id: number, mapping: Record<string, string>): Promise<void> {
  await api.post(`/datasets/${id}/remap-classes`, { mapping });
}

// --- Training ---
export async function createTrainingJob(config: TrainingConfig): Promise<TrainingJob> {
  const res = await api.post<TrainingJob>('/training/jobs', config);
  return res.data;
}

export async function getTrainingJobs(): Promise<TrainingJob[]> {
  const res = await api.get<TrainingJob[]>('/training/jobs');
  return res.data;
}

export async function getTrainingJob(id: number): Promise<TrainingJobDetail> {
  const res = await api.get<TrainingJobDetail>(`/training/jobs/${id}`);
  return res.data;
}

export async function cancelTrainingJob(id: number): Promise<void> {
  await api.post(`/training/jobs/${id}/cancel`);
}

// --- Models ---
export async function getModels(): Promise<MLModel[]> {
  const res = await api.get<MLModel[]>('/models');
  return res.data;
}

export async function getModel(id: number): Promise<MLModel> {
  const res = await api.get<MLModel>(`/models/${id}`);
  return res.data;
}

export async function deleteModel(id: number): Promise<void> {
  await api.delete(`/models/${id}`);
}

export async function importModel(
  file: File,
  name: string,
  accuracy?: number,
  classesStr?: string
): Promise<MLModel> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  if (accuracy !== undefined && accuracy !== null) {
    formData.append('accuracy', (accuracy / 100).toString());
  }
  if (classesStr) {
    formData.append('classes_str', classesStr);
  }

  const res = await api.post<MLModel>('/models/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

// --- Analysis ---
export async function predictVideo(
  file: File,
  modelId?: number | null,
  onProgress?: (pct: number) => void
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (modelId) {
    formData.append('model_id', modelId.toString());
  }

  const res = await api.post<AnalysisResult>('/analysis/predict', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });
  return res.data;
}

export async function predictVideoEnsemble(
  file: File,
  onProgress?: (pct: number) => void
): Promise<EnsembleAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await api.post<EnsembleAnalysisResult>('/analysis/predict-ensemble', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });
  return res.data;
}

export async function getAnalysisHistory(): Promise<AnalysisResult[]> {
  const res = await api.get<AnalysisResult[]>('/analysis/history');
  return res.data;
}

// --- System ---
export async function getGPUInfo(): Promise<GPUInfo> {
  const res = await api.get<GPUInfo>('/system/gpu-info');
  return res.data;
}

export default api;
