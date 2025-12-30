import { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader } from 'lucide-react';
import { uploadAPI } from '../services/api';
import './PDFUploader.css';

const PDFUploader = ({ onUploadComplete }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
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

    const handleFileChange = (e) => {
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
        setProgress('Uploading PDF to server...');

        try {
            const result = await uploadAPI.uploadPDF(file);

            if (result.success) {
                setSuccess(true);
                setUploadResult(result.data);
                setProgress(`Successfully uploaded ${result.data.totalQuestions} questions!`);

                setTimeout(() => {
                    if (onUploadComplete) {
                        onUploadComplete(result.data);
                    }
                }, 1500);
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload PDF. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const resetUpload = () => {
        setFile(null);
        setError('');
        setSuccess(false);
        setProgress('');
        setUploadResult(null);
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

            {progress && (
                <div className="progress-message">
                    {uploading && <Loader className="spinner" size={20} />}
                    <span>{progress}</span>
                </div>
            )}

            {uploadResult && success && (
                <div className="upload-summary">
                    <h4>Upload Summary:</h4>
                    <div className="summary-stats">
                        <div className="stat-item">
                            <span className="stat-label">Total Questions:</span>
                            <span className="stat-value">{uploadResult.totalQuestions}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Math Questions:</span>
                            <span className="stat-value">{uploadResult.mathQuestions}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">English Questions:</span>
                            <span className="stat-value">{uploadResult.englishQuestions}</span>
                        </div>
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
                    <span>{progress}</span>
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
