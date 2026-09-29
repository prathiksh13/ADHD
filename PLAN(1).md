# PS5 ADHD-LSTM Project Plan

## Project Title
**Neurological State Changes Indicative of ADHD in Children Learned via EEG-Based LSTM Networks**

## 1. Project Goal

Develop and evaluate an EEG-based machine learning system for distinguishing ADHD and healthy/control subjects using temporal patterns in EEG signals.

The main research work will use public EEG datasets. A future extension will connect a real EEG device to a laptop and feed live EEG signals into the same processing and model pipeline.

> **Research output is for experimental/screening research, not clinical diagnosis.**

---

# 2. Research Strategy

The project will be built in stages rather than jumping directly to a complex model.

```text
Public EEG Dataset
        ↓
Understand Dataset
        ↓
Preprocessing
        ↓
Feature Extraction
        ↓
Time-Series Construction
        ↓
LSTM Baseline
        ↓
Subject-Independent Evaluation
        ↓
Research Experiments
        ↓
CNN-LSTM
        ↓
Attention
        ↓
Behavioral / Multimodal Experiments (if supported)
        ↓
Interpretation
        ↓
Evaluator Prototype
        ↓
Future Live-EEG Prototype
```

---

# 3. Baseline From the Original Paper

The original Chang et al. paper will be treated as the baseline to reproduce and improve.

### Baseline pipeline

```text
EEG
 ↓
1–50 Hz filtering
 ↓
Artifact removal
 ↓
FFT / PSD
 ↓
Delta + Theta + Alpha + Beta
 ↓
32 features
(8 channels × 4 bands)
 ↓
1-second windows
 ↓
60 × 32 time-series input
 ↓
2-layer LSTM
 ↓
Dense
 ↓
Softmax
 ↓
ADHD / Healthy
```

### Baseline evaluation

- Subject-independent evaluation.
- Leave-One-Subject-Out Cross Validation (LOSOCV) where appropriate.
- Keep subjects separated between training and test data.
- Compare results using the same preprocessing and splits.

---

# 4. Dataset Selection

Candidate dataset combinations:

## EEG
- IEEE DataPort: EEG Data for ADHD Control Children
- Healthy Brain Network (HBN) EEG
- ATTLAPSE ADHD EEG

## EEG + Behavior
- HBN
- ATTLAPSE

## EEG + MRI
- HBN
- Oregon ADHD-1000

## EEG + ECG
- OpenNeuro ds003838
- NKI Naturalistic Viewing

## EEG + ECG + MRI
- NKI Naturalistic Viewing
- OpenNeuro ds007216

### Dataset selection rules

Before downloading large datasets, verify:

- Number of subjects
- ADHD/control labels
- Age range
- EEG availability
- MRI availability for the same subjects
- ECG availability if required
- Behavioral variables
- EEG channels
- Sampling rate
- Recording duration
- Raw file format
- Data quality
- Subject-independent evaluation feasibility
- License/access requirements

For multimodal experiments, calculate the actual intersection:

```text
Subjects with EEG
      ∩
Subjects with MRI
      ∩
Subjects with ADHD/control labels
      ∩
Subjects with required behavioral/ECG data
      ↓
Usable multimodal cohort
```

Do not assume that the total number of EEG and MRI subjects equals the number of multimodal subjects.

---

# 5. Stage 1 — Dataset Understanding

### Tasks

1. Download/access the selected dataset.
2. Understand the folder structure.
3. Identify participant IDs.
4. Identify labels and metadata.
5. Inspect EEG file formats.
6. Identify channels and sampling rates.
7. Measure recording durations.
8. Check missing data.
9. Check whether behavioral data are available.
10. Check whether the same subjects have multiple modalities.

### Output

Create a dataset report containing:

- Subject count
- ADHD/control count
- Age distribution
- Sex information if available
- Channel count
- Sampling rate
- Recording length
- Task/rest conditions
- File types
- Available modalities
- Missing data

---

# 6. Stage 2 — EEG Preprocessing

Use the same preprocessing philosophy across all model comparisons.

### Core pipeline

```text
Raw EEG
 ↓
Load with MNE
 ↓
Channel inspection
 ↓
Filtering
 ↓
Re-referencing if required
 ↓
Artifact handling
 ↓
Segmentation
 ↓
Feature extraction
```

Potential artifact sources:

- Eye blinks / eye movements
- Muscle activity
- Head/body movement
- Electrical/environmental noise

Artifact handling should be documented carefully. Do not automatically label artifacts as behavioral data.

---

# 7. Stage 3 — Frequency Feature Extraction

## Baseline

Use the four bands corresponding to the original baseline representation:

- Delta
- Theta
- Alpha
- Beta

With 8 channels:

```text
8 channels × 4 bands = 32 features
```

## Gamma experiment

Add an experimental fifth band:

```text
Delta + Theta + Alpha + Beta + Gamma
```

This gives:

```text
8 channels × 5 bands = 40 features
```

Gamma must be evaluated experimentally. Do not assume that adding Gamma improves classification.

---

# 8. Stage 4 — Temporal Window Experiments

The original paper found 1 second useful for its EEG power representation.

Our controlled experiment should compare:

```text
0.5 seconds
1.0 second  ← baseline
2.0 seconds
```

Optional:

```text
0.1 seconds
```

The purpose is to study the trade-off between temporal resolution, frequency estimation, artifacts, computation, and model performance.

Do not assume that a smaller window is automatically better.

---

# 9. Stage 5 — Model Development

Build models incrementally.

## Model 1 — LSTM Baseline

```text
Input
 ↓
LSTM
 ↓
Dense
 ↓
Output
```

Purpose:

- Reproduce the baseline concept.
- Establish a reference score.

## Model 2 — CNN

```text
EEG feature representation
 ↓
CNN
 ↓
Dense
 ↓
Output
```

Purpose:

- Learn local patterns in the input representation.
- Provide a comparison with the standalone CNN used in the original paper.

## Model 3 — CNN-LSTM

```text
EEG
 ↓
CNN
 ↓
Learned feature representation
 ↓
LSTM
 ↓
Dense
 ↓
Output
```

Interpretation:

- CNN learns local channel/frequency patterns.
- LSTM learns how those patterns evolve over time.

## Model 4 — CNN-LSTM + Attention

```text
EEG
 ↓
CNN
 ↓
LSTM
 ↓
Attention
 ↓
Dense
 ↓
ADHD / Healthy
```

Attention can help analyze which temporal regions contribute to the model decision.

---

# 10. Input Representation for CNN-LSTM

For each time window, preserve channel × frequency structure where practical.

Example:

```text
             Delta  Theta  Alpha  Beta
Fp1             ×      ×      ×      ×
Fp2             ×      ×      ×      ×
Fz              ×      ×      ×      ×
C3              ×      ×      ×      ×
C4              ×      ×      ×      ×
Pz              ×      ×      ×      ×
O1              ×      ×      ×      ×
O2              ×      ×      ×      ×
```

Conceptually:

```text
Per time step:
8 × 4 → CNN → learned feature vector

Across time:
feature₁ → feature₂ → ... → feature₆₀
                      ↓
                     LSTM
```

Important modeling note: electrode ordering is not identical to true physical scalp geometry, so any CNN arrangement must be documented as a modeling assumption and evaluated experimentally.

---

# 11. Stage 6 — Behavioral Experiments

Only use behavioral information if the selected dataset provides suitable subject-level or time-aligned behavioral data.

Build three branches:

## Model A — EEG only

```text
EEG → CNN-LSTM / LSTM → Output
```

## Model B — Behavior only

```text
Behavior → ML/DL model → Output
```

## Model C — EEG + Behavior

```text
EEG → CNN-LSTM ───────┐
                     ├→ Fusion → Output
Behavior → MLP ──────┘
```

Possible behavioral variables:

- Response
- Reaction time
- Correct/incorrect response
- Missed targets
- Task score
- Experiment condition

The comparison should answer whether behavioral information adds useful information beyond EEG alone.

---

# 12. Stage 7 — MRI Experiment (Advanced)

If a selected dataset provides enough same-subject EEG + MRI data:

```text
EEG → CNN-LSTM ───────┐
                      │
MRI → CNN / 3D CNN ───┤
                      ↓
               Multimodal Fusion
                      ↓
                Classification
```

This should remain an advanced experiment rather than a requirement for the first working system.

Only proceed if the usable same-subject cohort is sufficiently large and the labels are reliable.

---

# 13. Stage 8 — Evaluation

Use subject-independent evaluation throughout the research.

### Metrics

- Accuracy
- Precision
- Recall / Sensitivity
- Specificity
- F1-score
- AUC / ROC-AUC
- Confusion matrix

### Rules

1. Split by subject, not by random EEG windows.
2. Never allow windows from the same person to leak into both train and test sets.
3. Hyperparameter tuning must not use the final test subject.
4. Keep preprocessing consistent across compared models.
5. Report negative results as well as improvements.
6. Report uncertainty/variation appropriately.

---

# 14. Stage 9 — Explainability and EEG Pattern Analysis

Study:

- Important channels
- Important frequency bands
- Important temporal regions
- Model feature importance
- Attention weights, if used
- Class-specific feature behavior

Possible outputs:

```text
Channel importance
Band importance
Time importance
Prediction probability
Confusion matrix
ROC curve
EEG waveform
Band-power plots
Spectrogram / PSD
```

The analysis should connect model decisions to measurable EEG features rather than only reporting accuracy.

---

# 15. Stage 10 — New EEG Evaluator Prototype

The evaluator should be able to upload an unseen EEG recording.

```text
New EEG file
 ↓
Same preprocessing
 ↓
Same feature extraction
 ↓
Same time-series creation
 ↓
Trained model
 ↓
Prediction
```

The evaluator should not manually enter the 32/40 features.

If the ground truth is unknown, the system can demonstrate inference but cannot demonstrate whether the prediction is correct.

Example UI result:

```text
Prediction: ADHD
Model probability: 0.72

Research prototype
Not a clinical diagnosis
```

---

# 16. Website Architecture for Research Prototype

## Frontend

Use:

- React
- Next.js

Potential pages/features:

- Dataset / EEG upload
- EEG visualization
- Processing status
- Feature visualization
- Prediction
- Model results
- Session history
- Experiment dashboard

---

# 17. Future Live-EEG Prototype

This is future scope, not a dependency for the main research.

## Target architecture

```text
EEG DEVICE
    ↓
Electrodes
    ↓
EEG Amplifier / Device
    ↓
USB / Bluetooth / BLE / Wi-Fi / Wireless Receiver
    ↓
LAPTOP
    ↓
BrainFlow / Manufacturer SDK
    ↓
Python EEG Acquisition Layer
    ↓
FastAPI
    ├──────────────→ Raw EEG Storage
    │
    ├──────────────→ EEG Processing
    │                   ↓
    │              Band Powers
    │                   ↓
    │              Time Series
    │                   ↓
    │              Trained Model
    │                   ↓
    │               Prediction
    │
    └──────────────→ WebSocket
                         ↓
                    React / Next.js
                         ↓
                 Live EEG Dashboard
```

The hardware must not be tied specifically to OpenBCI. The acquisition layer should be replaceable.

---

# 18. Live EEG Acquisition Layer

Use BrainFlow or the manufacturer's device SDK.

Required functions:

- Connect to device
- Start stream
- Stop stream
- Read live EEG samples
- Access channels
- Obtain timestamps
- Record raw EEG
- Handle device/session status

Keep the acquisition layer separate from preprocessing and ML so hardware can be swapped later.

---

# 19. FastAPI Backend

Responsibilities:

- EEG device/session connection
- Start/stop recording
- Receive raw EEG
- Preprocess EEG
- Artifact handling
- Frequency extraction
- Time-series creation
- LSTM/CNN-LSTM inference
- Save recordings
- Store experiment/event timestamps
- Return results

### REST API examples

```text
POST /api/session/start
POST /api/session/stop
POST /api/experiment/start
POST /api/experiment/event
GET  /api/session/{id}
GET  /api/session/{id}/results
```

---

# 20. WebSocket Architecture

Use WebSocket for continuous streaming.

```text
EEG Device
   ↓
Python
   ↓
FastAPI
   ↓
WebSocket
   ↓
React / Next.js
```

REST handles commands, metadata, and results.

WebSocket handles the continuous live EEG/processed stream.

---

# 21. Website Live Dashboard

Display:

- EEG connection status
- Live EEG waveform
- Channel information
- Recording timer
- Current experiment
- Frequency-band power
- Model output
- Prediction probability/confidence
- Session information
- Recorded-session results

---

# 22. Live Experiments and Synchronization

The website should support controlled experiments while EEG is recorded.

Example:

```text
REST_START
    ↓
REST_END
    ↓
TASK_START
    ↓
stimulus
    ↓
response / miss
    ↓
TASK_END
```

Every EEG segment and experiment event should have a timestamp.

Example:

```text
00:00  REST_START
00:30  REST_END
00:30  TASK_START
00:32  TARGET
00:32.7 RESPONSE
00:35  TARGET
00:36  MISS
01:00  TASK_END
```

This enables analysis of the actual rest → task transition instead of manually concatenating separate recordings.

---

# 23. Live Behavioral Data

Where applicable, collect:

- Response
- Reaction time
- Correct/incorrect response
- Missed target
- Task score
- Experiment condition

This will eventually support the same three-way comparison:

```text
EEG only
Behavior only
EEG + Behavior
```

---

# 24. Live Recording Storage

Save full-resolution raw EEG, not only the web visualization stream.

Store:

- Raw EEG
- Timestamps
- Channel information
- Experiment events
- Behavioral responses
- Session metadata
- Processed features
- Model results

The website is the interface; the Python/backend layer handles recording and processing.

---

# 25. Live ML Pipeline

Once enough data are available for a sequence:

```text
Live EEG
 ↓
Preprocessing
 ↓
Band powers
 ↓
Time-series buffer
 ↓
Trained model
 ↓
Prediction
 ↓
WebSocket
 ↓
Website
```

Example display:

```text
ADHD probability: 0.72
Confidence: 72%
```

This must be labeled as model output for research purposes.

---

# 26. Development Order

## Phase 1 — Research Foundation

- Select dataset
- Understand files/labels
- Build data loader
- Preprocess EEG
- Extract features

## Phase 2 — Baseline

- Implement LSTM
- Reproduce baseline representation
- Implement subject-independent evaluation
- Record baseline metrics

## Phase 3 — Research Experiments

- 4 vs 5 frequency bands
- 0.5s vs 1s vs 2s windows
- LSTM vs CNN vs CNN-LSTM
- CNN-LSTM + Attention
- Interpretability analysis

## Phase 4 — Behavioral Branch

- Identify usable behavioral data
- Build behavior-only model
- Build EEG + behavior fusion model
- Compare against EEG-only baseline

## Phase 5 — Advanced Multimodal Branch

- Check same-subject EEG + MRI availability
- Build MRI representation
- Build multimodal fusion experiment if feasible

## Phase 6 — Evaluator Prototype

- EEG file upload
- Automatic preprocessing
- Automatic feature extraction
- Prediction
- Visualization

## Phase 7 — Future Live EEG

- Build hardware abstraction layer
- Add BrainFlow / device SDK
- Add FastAPI session control
- Add WebSocket streaming
- Add real-time visualization
- Add experiment/event synchronization
- Add raw recording
- Connect the trained model

---

# 27. Research Questions

### RQ1
Does adding Gamma-frequency information improve ADHD classification compared with the original four-band representation?

### RQ2
How does temporal-window size affect subject-independent ADHD classification?

### RQ3
Does CNN-LSTM capture useful spatial-temporal EEG patterns beyond the LSTM baseline?

### RQ4
Does attention improve model representation and interpretation of important time periods?

### RQ5
If objective behavioral information is available, does combining behavior with EEG improve classification compared with EEG alone?

### RQ6
Which EEG channels, frequency bands, and temporal regions contribute most to model decisions?

### RQ7
If a suitable multimodal cohort exists, does adding MRI information provide useful information beyond EEG alone?

---

# 28. Experimental Matrix

| Experiment | Input | Model | Main Question |
|---|---|---|---|
| E1 | EEG, 4 bands | LSTM | Baseline |
| E2 | EEG, 5 bands | LSTM | Does Gamma help? |
| E3 | EEG, different windows | LSTM | Does temporal resolution matter? |
| E4 | EEG | CNN | Local pattern comparison |
| E5 | EEG | CNN-LSTM | Spatial + temporal learning |
| E6 | EEG | CNN-LSTM + Attention | Temporal importance |
| E7 | Behavior | ML/DL | Behavior-only information |
| E8 | EEG + Behavior | Fusion model | Multimodal benefit |
| E9 | EEG + MRI | Multimodal fusion | Cross-modality benefit |

Only run experiments supported by the selected dataset.

---

# 29. Scientific Rules

1. Do not claim novelty merely because CNN-LSTM or Attention is used.
2. Do not compare models using different subject splits.
3. Do not create subject leakage through window-level random splitting.
4. Do not assume Gamma improves performance.
5. Do not assume more data points means more useful information.
6. Do not call EEG artifacts behavioral data unless the dataset provides behavioral measurements.
7. Do not claim clinical diagnosis from the model.
8. Report negative and positive experimental results.
9. Explain assumptions in the EEG-to-CNN representation.
10. Keep baseline reproduction separate from proposed improvements.

---

# 30. Final Target System

```text
                         PUBLIC DATASET
                               │
                               ▼
                         EEG / Metadata
                               │
                               ▼
                         Preprocessing
                               │
                               ▼
                    Frequency + Time Features
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
              Baseline                  Experiments
                 │                           │
              LSTM                 CNN-LSTM + Attention
                 │                           │
                 └─────────────┬─────────────┘
                               ▼
                     Subject-independent
                          Evaluation
                               │
                               ▼
                     Interpretation / RQs
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
             EEG-only      EEG+Behavior    EEG+MRI*
                │              │              │
                └──────────────┼──────────────┘
                               ▼
                         Research Prototype
                               │
                               ▼
                         Future Live EEG
                               │
                    EEG Device → Laptop
                               │
                    BrainFlow / Device SDK
                               │
                            FastAPI
                               │
                         WebSocket
                               │
                         React / Next.js
                               │
                         Live Dashboard

*Only if the chosen dataset provides enough same-subject multimodal data.
```

---

# 31. Immediate Next Steps

1. Finalize the primary dataset.
2. Inspect its actual subject/modality intersection.
3. Build the dataset loader and preprocessing pipeline.
4. Reproduce the LSTM baseline.
5. Establish subject-independent evaluation.
6. Run the frequency-band and temporal-window experiments.
7. Implement CNN-LSTM.
8. Add Attention only after the CNN-LSTM baseline is stable.
9. Add behavioral fusion if the dataset supports it.
10. Build the evaluator website.
11. Keep live EEG as the future hardware extension using the same processing pipeline.
