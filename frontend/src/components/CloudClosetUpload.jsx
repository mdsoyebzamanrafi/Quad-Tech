import React, { useEffect, useState } from 'react';
import { ImagePlus, UploadCloud, X } from 'lucide-react';

const CloudClosetUpload = ({
    count,
    limit,
    uploading,
    onUpload,
}) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const limitReached = Number(count) >= Number(limit);

    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl('');
            return undefined;
        }

        const nextPreviewUrl = URL.createObjectURL(selectedFile);
        setPreviewUrl(nextPreviewUrl);

        return () => URL.revokeObjectURL(nextPreviewUrl);
    }, [selectedFile]);

    const handleFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        setSelectedFile(file);
    };

    const clearSelection = () => {
        setSelectedFile(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!selectedFile || uploading || limitReached) {
            return;
        }

        const uploaded = await onUpload(selectedFile);
        if (uploaded) {
            clearSelection();
        }
    };

    return (
        <section className="cloud-closet-upload glass">
            <div className="cloud-closet-upload-copy">
                <p className="cloud-closet-kicker">Upload Slot</p>
                <h2>{count}/{limit} uploaded</h2>
                {limitReached ? (
                    <p>Upload limit reached. Delete an item to upload another.</p>
                ) : (
                    <p>Choose a clothing image and Gemini will extract fashion attributes for recommendations.</p>
                )}
            </div>

            <form className="cloud-closet-upload-form" onSubmit={handleSubmit}>
                <label className={`cloud-closet-file-drop ${limitReached ? 'disabled' : ''}`}>
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        disabled={limitReached || uploading}
                    />
                    {previewUrl ? (
                        <img src={previewUrl} alt="Selected clothing preview" />
                    ) : (
                        <span className="cloud-closet-file-placeholder">
                            <ImagePlus size={30} />
                            <span>Select image</span>
                        </span>
                    )}
                </label>

                {selectedFile && (
                    <div className="cloud-closet-selected-row">
                        <span>{selectedFile.name}</span>
                        <button
                            type="button"
                            className="cloud-closet-icon-button"
                            onClick={clearSelection}
                            disabled={uploading}
                            aria-label="Clear selected image"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}

                {uploading && (
                    <p className="cloud-closet-status-text">
                        Uploading and analyzing your clothing item...
                    </p>
                )}

                <button
                    type="submit"
                    className="btn btn-primary cloud-closet-upload-button"
                    disabled={!selectedFile || uploading || limitReached}
                >
                    <UploadCloud size={18} />
                    {uploading ? 'Analyzing...' : 'Upload'}
                </button>
            </form>
        </section>
    );
};

export default CloudClosetUpload;
