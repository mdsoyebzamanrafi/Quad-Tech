import React, { useRef } from 'react';
import { Camera, Image, Upload, X } from 'lucide-react';
import { normalizeStringList } from '../utils/productUtils';

const joinValues = (values) => normalizeStringList(values).join(', ');

const buildIntentChips = (intent) => {
    if (!intent) {
        return [];
    }

    const chips = [];

    if (intent.category) chips.push(intent.category);
    if (intent.productType) chips.push(intent.productType);
    if (intent.gender) chips.push(intent.gender);
    if (intent.requestedColors?.length) chips.push(joinValues(intent.requestedColors));
    if (intent.requestedMaterials?.length) chips.push(joinValues(intent.requestedMaterials));
    if (intent.fit) chips.push(intent.fit);
    if (intent.occasion) chips.push(intent.occasion);
    if (intent.season) chips.push(intent.season);
    if (intent.styleTags?.length) chips.push(joinValues(intent.styleTags));

    return chips;
};

const ImageProductSearch = ({
    imageSearchFile,
    imageSearchPreview,
    imageSearchLoading,
    imageSearchError,
    imageSearchResult,
    imageSearchActive,
    onFileChange,
    onSubmit,
    onClear,
}) => {
    const inputRef = useRef(null);
    const intentChips = buildIntentChips(imageSearchResult?.intent);

    const handleOpenPicker = () => {
        inputRef.current?.click();
    };

    const handleClear = () => {
        if (inputRef.current) {
            inputRef.current.value = '';
        }

        onClear();
    };

    return (
        <div className="image-search-panel">
            <div className="image-search-header">
                <div>
                    <p className="image-search-kicker">Visual Search</p>
                    <h3>Search by image</h3>
                    <p>Upload a fashion product photo and we’ll find similar items from the catalog.</p>
                </div>

                <div className="image-search-actions">
                    <button
                        type="button"
                        className="image-search-trigger"
                        onClick={handleOpenPicker}
                        disabled={imageSearchLoading}
                    >
                        <Camera size={18} />
                        Choose Image
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="image-search-input"
                        onChange={onFileChange}
                        disabled={imageSearchLoading}
                    />
                </div>
            </div>

            <div className={`image-search-preview-shell ${imageSearchPreview ? 'has-image' : ''}`}>
                {imageSearchPreview ? (
                    <img src={imageSearchPreview} alt="Selected product preview" className="image-search-preview" />
                ) : (
                    <div className="image-search-placeholder">
                        <Image size={26} />
                        <span>JPEG, PNG, or WebP up to 5MB</span>
                    </div>
                )}

                <div className="image-search-preview-copy">
                    <p>{imageSearchFile ? imageSearchFile.name : 'No image selected yet.'}</p>
                    <div className="image-search-button-row">
                        <button
                            type="button"
                            className="btn btn-primary image-search-submit"
                            onClick={onSubmit}
                            disabled={!imageSearchFile || imageSearchLoading}
                        >
                            <Upload size={17} />
                            {imageSearchLoading ? 'Analyzing...' : 'Find Similar Products'}
                        </button>
                        {(imageSearchFile || imageSearchActive) && (
                            <button
                                type="button"
                                className="image-search-clear"
                                onClick={handleClear}
                                disabled={imageSearchLoading}
                            >
                                <X size={16} />
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {imageSearchLoading && (
                <p className="image-search-status">
                    Analyzing image and finding products...
                </p>
            )}

            {imageSearchError && <p className="image-search-error">{imageSearchError}</p>}

            {imageSearchActive && imageSearchResult && !imageSearchLoading && (
                <div className="image-search-result-meta">
                    <p className="image-search-message">
                        {imageSearchResult.message || 'Found products similar to your image.'}
                    </p>
                    {intentChips.length > 0 && (
                        <div className="image-intent-chip-row">
                            {intentChips.map((chip) => (
                                <span key={chip} className="image-intent-chip">
                                    {chip}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ImageProductSearch;
