'use client';
import { useState, useEffect, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader, Terminal } from 'lucide-react';
import './PDFUploader.css';

interface PDFUploaderProps {
    onUploadComplete?: (result: unknown) => void;
}

interface ProgressState {
    status: string;
    progress: number;
    logs: string[];
    result?: unknown;
}

const PDFUploader = ({ onUploadComplete }: PDFUploaderProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [fileId, setFileId] = useState<string | null>(null);
    const [progress, setProgress] = useState<ProgressState>({ status: '', progress: 0, logs: [] });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [showConsole, setShowConsole] = useState(false);
    const consoleRef = useRef<HTMLDivElement>(null);

    // Poll for progress when uploading
    useEffect(() => {
        if (!fileId || !uploading) return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/upload?file=${encodeURIComponent(fileId)}`);
                const data = await response.json();

                if (data.success && data.data) {
                    setProgress({
                        status: data.data.status,
                        progress: data.data.progress,
                        logs: data.data.logs || [],
                        result: data.data.result
                    });

                    // Check if complete
                    if (data.data.progress === 100) {
                        clearInterval(pollInterval);
                        setUploading(false);
                        setSuccess(true);

                        setTimeout(() => {
                            if (onUploadComplete && data.data.result) {
                                onUploadComplete(data.data.result);
                            }
                        }, 1500);
                    }

                    // Check if error
                    if (data.data.progress === -1) {
                        clearInterval(pollInterval);
                        setError(data.data.status || 'Processing failed');
                        setUploading(false);
                    }
                }
            } catch (err) {
                console.error('Error polling progress:', err);
            }
        }, 1000);

        return () => clearInterval(pollInterval);
    }, [fileId, uploading, onUploadComplete]);

    // Auto-scroll console to bottom
    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [progress.logs]);

    const handleDrag = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type === 'application/pdf') {
                setFile(droppedFile);
                setError('');
            } else {
                setError('Please upload a PDF file');
            }
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type === 'application/pdf') {
                setFile(selectedFile);
                setError('');
            } else {
                setError('Please upload a PDF file');
            }
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a PDF file');
            return;
        }

        setUploading(true);
        setError('');
        setSuccess(false);
        setShowConsole(true);
        setProgress({ status: 'Uploading...', progress: 5, logs: [] });

        try {
            const formData = new FormData();
            formData.append('pdf', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success && result.fileId) {
                setFileId(result.fileId);
                setProgress(prev => ({
                    ...prev,
                    status: 'Processing started...',
                    progress: 10
                }));
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (err) {
            console.error('Upload error:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload PDF. Please try again.');
            setUploading(false);
        }
    };

    const resetUpload = () => {
        setFile(null);
        setFileId(null);
        setError('');
        setSuccess(false);
        setShowConsole(false);
        setProgress({ status: '', progress: 0, logs: [] });
    };

    return (
        <div className="pdf-uploader">
            <div className="uploader-header">
                <h2>Upload SAT Questions</h2>
                <p>Upload a PDF file containing SAT exam questions (Math and/or English)</p>
            </div>

            <div
                className={`drop-zone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    id="file-input"
                    accept=".pdf"
                    onChange={handleFileChange}
                    disabled={uploading}
                    style={{ display: 'none' }}
                />

                {!file ? (
                    <label htmlFor="file-input" className="drop-zone-content">
                        <Upload size={48} />
                        <h3>Drop PDF file here or click to browse</h3>
                        <p>Supports PDF files with Math and English questions</p>
                    </label>
                ) : (
                    <div className="file-info">
                        <FileText size={48} />
                        <h3>{file.name}</h3>
                        <p>{(file.size / 1024).toFixed(2)} KB</p>
                        {!uploading && !success && (
                            <button onClick={resetUpload} className="btn btn-sm btn-secondary">
                                Change File
                            </button>
                        )}
                    </div>
                )}
            </div>

            {(uploading || showConsole) && (
                <div className="progress-container">
                    <div className="progress-bar-wrapper">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${Math.max(5, progress.progress)}%` }}
                        ></div>
                    </div>
                    <div className="progress-info">
                        <div className="progress-status">
                            {uploading && <Loader className="spinner" size={14} />}
                            {success && <CheckCircle size={14} className="text-success" />}
                            <span>{progress.status}</span>
                        </div>
                        <span className="progress-percentage">{Math.max(0, progress.progress)}%</span>
                    </div>
                </div>
            )}

            {showConsole && progress.logs.length > 0 && (
                <div className="console-container">
                    <div className="console-header">
                        <Terminal size={14} />
                        <span>Processing Log</span>
                    </div>
                    <div className="console-output" ref={consoleRef}>
                        {progress.logs.map((log, index) => (
                            <div key={index} className="console-line">{log}</div>
                        ))}
                    </div>
                </div>
            )}

            {error && (
                <div className="error-message">
                    <XCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="success-message">
                    <CheckCircle size={20} />
                    <span>Successfully processed and imported!</span>
                </div>
            )}

            <div className="uploader-actions">
                <button
                    onClick={handleUpload}
                    disabled={!file || uploading || success}
                    className="btn btn-primary btn-lg"
                >
                    {uploading ? (
                        <>
                            <Loader className="spinner" size={20} />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Upload size={20} />
                            Upload Questions
                        </>
                    )}
                </button>
            </div>

            <div className="ai-hint">
                <p>🤖 Our AI will automatically recognize and import questions from your PDF - no special format required!</p>
            </div>
        </div>
    );
};

export default PDFUploader;
