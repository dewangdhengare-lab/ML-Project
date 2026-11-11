import React, { useRef, useState } from 'react';
import { UploadCloud, File as FileIcon, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // In bytes
  label?: string;
  uploadProgress?: number | null; // 0 to 100 or null if not uploading
  disabled?: boolean;
  hint?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  accept = '*/*',
  multiple = false,
  maxSize,
  label = 'Drag and drop files here, or click to browse',
  uploadProgress = null,
  disabled = false,
  hint,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateAndAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);

    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file size
      if (maxSize && file.size > maxSize) {
        setErrorMessage(`File "${file.name}" exceeds maximum allowed size of ${formatFileSize(maxSize)}.`);
        return;
      }
      newFiles.push(file);
    }

    const updatedFiles = multiple ? [...selectedFiles, ...newFiles] : newFiles;
    setSelectedFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    validateAndAddFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndAddFiles(e.target.files);
    // Reset input so same file can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    onFilesSelected(updated);
  };

  return (
    <div className="w-full space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center group ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-950/20 shadow-lg glow-indigo'
            : 'border-gray-800 bg-gray-900/60 hover:bg-gray-900 hover:border-gray-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="p-3 bg-gray-800/80 rounded-full border border-gray-700 text-indigo-400 group-hover:scale-110 group-hover:text-indigo-300 transition-transform">
          <UploadCloud className="w-7 h-7" />
        </div>

        <p className="mt-3 text-sm font-medium text-gray-200">{label}</p>
        <p className="mt-1 text-xs text-gray-400">
          {hint || (accept ? `Accepted formats: ${accept}` : 'All files supported')}
          {maxSize ? ` (Up to ${formatFileSize(maxSize)})` : ''}
        </p>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 text-xs text-red-400 bg-red-950/30 border border-red-800/50 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span className="font-medium">Uploading files...</span>
            <span className="font-mono">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Selected Files ({selectedFiles.length})
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between p-2.5 bg-gray-900/80 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <FileIcon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span className="text-gray-200 truncate font-medium">{file.name}</span>
                  <span className="text-gray-400 font-mono text-[11px]">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                {!disabled && uploadProgress === null && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(idx);
                    }}
                    className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {uploadProgress === 100 && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
