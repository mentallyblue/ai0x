// Add indexes for commonly queried fields
const AnalysisSchema = new Schema({
    // ... existing schema ...
}, {
    timestamps: true
});

// Add compound index for sorting and filtering
AnalysisSchema.index({ lastAnalyzed: -1, language: 1 });
AnalysisSchema.index({ 'analysis.finalLegitimacyScore': -1 }); 