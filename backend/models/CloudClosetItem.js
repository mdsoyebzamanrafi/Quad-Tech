import mongoose from 'mongoose';

const cloudClosetAttributesSchema = new mongoose.Schema(
    {
        department: String,
        category: String,
        productType: String,
        gender: String,
        colors: [String],
        sizes: [String],
        material: String,
        fit: String,
        occasion: String,
        season: String,
        styleTags: [String],
        keywords: [String],
        confidence: Number,
    },
    { _id: false }
);

const cloudClosetItemSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        imageUrl: {
            type: String,
            required: true,
        },
        cloudinaryPublicId: {
            type: String,
            required: true,
        },
        originalFilename: String,
        aiProvider: {
            type: String,
            default: 'gemini',
        },
        aiModel: String,
        analysisStatus: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending',
        },
        analysisError: String,
        attributes: cloudClosetAttributesSchema,
        rawAiResponse: mongoose.Schema.Types.Mixed,
    },
    { timestamps: true }
);

cloudClosetItemSchema.index({ user: 1, createdAt: -1 });

const CloudClosetItem = mongoose.model('CloudClosetItem', cloudClosetItemSchema);

export default CloudClosetItem;
