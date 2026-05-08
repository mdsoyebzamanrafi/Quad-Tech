import React from 'react';

const COLOR_SWATCHES = ['#ff0000', '#111827', '#1e90ff', '#10b981', '#f59e0b', '#ec4899'];

const ColorPicker = ({ value, onChange }) => (
    <div className="designer-sidebar-section">
        <div className="designer-section-heading">
            <span>Shirt Color</span>
            <strong>{value}</strong>
        </div>

        <div className="designer-color-picker">
            <input
                type="color"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-label="Choose shirt color"
            />
            <input
                type="text"
                value={value}
                aria-label="Shirt color hex value"
                maxLength={7}
                readOnly
            />
        </div>

        <div className="designer-swatches">
            {COLOR_SWATCHES.map((color) => (
                <button
                    key={color}
                    type="button"
                    className={`designer-swatch ${value.toLowerCase() === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => onChange(color)}
                    aria-label={`Use ${color}`}
                    title={color}
                />
            ))}
        </div>
    </div>
);

export default ColorPicker;
