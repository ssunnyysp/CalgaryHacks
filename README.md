# 🎯 Luminate - Logical Fallacy Detector Chrome Extension

A real-time logical fallacy detector for Chrome that analyzes highlighted text on any webpage.

## 📋 What It Does

- **Highlight text** on any webpage with 6 color options
- **Detect logical fallacies** automatically (ad hominem, strawman, slippery slope, etc.)
- **View analysis** in the extension popup (fallacy type + confidence score)
- **Save highlights** per page with persistent storage
- **Batch operations** to clear page or all highlights

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│     Chrome Extension (Frontend)          │
│  ├─ content.js (text analysis & UI)     │
│  ├─ popup.html/popupLogic.js (UI)       │
│  └─ background.js (service worker)      │
└──────────────────┬──────────────────────┘
                   │ HTTP
                   ▼
┌────────────────────────────────────────────────┐
│    Express Server (Node.js)                    │
│  ├─ POST /analyze (single text)               │
│  ├─ POST /batch-analyze (multiple texts)      │
│  └─ GET /health (liveness check)              │
└──────────────────┬───────────────────────────┘
                   │ Subprocess
                   ▼
┌────────────────────────────────────────────────┐
│    Python ML Pipeline                          │
│  ├─ Stage 1: Binary (has_fallacy or not)      │
│  ├─ Stage 2: Multi-class (fallacy type)       │
│  └─ Models: TF-IDF + Logistic Regression      │
└────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 14+
- Python 3.8+
- Chrome browser

### 1. Install Dependencies

```bash
# Node dependencies
npm install

# Python dependencies
cd Logic
pip install -r req.txt
cd ..
```

### 2. Train Models
```bash
cd Logic
python train_stage1.py  # Binary classifier
python train.py        # Multi-class classifier
cd ..
```

This creates 4 model files:
- `stage1_model.pkl` / `stage1_vectorizer.pkl` - Does text contain fallacy?
- `model.pkl` / `vectorizer.pkl` - What type of fallacy?

### 3. Start the Backend Server

```bash
npm start
```

Server runs on `http://localhost:3000`

Endpoints:
- `POST /analyze` - Analyze a single text
- `POST /batch-analyze` - Analyze multiple texts
- `GET /health` - Health check
- `GET /bridge-health` - Check data logging bridge

### 4. Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top-right)
3. Click "Load unpacked"
4. Select this project folder

The Luminate icon should appear in your toolbar.

## 📊 Usage

1. Click the **Luminate** icon in toolbar
2. Toggle **"On"** to enable highlighting
3. Select any text on a webpage to highlight it
4. The extension sends it to the backend for analysis
5. View results in the popup:
   - **Text** - What you highlighted
   - **Fallacy Type** - ad_hominem, strawman, etc.
   - **Confidence** - How certain the model is (shown if >50%)

## 🔍 Detected Fallacies

- **no_fallacy** - Not a logical fallacy
- **ad_hominem** - Attacking the person instead of argument
- **strawman** - Attacking a distorted version of argument
- **false_dilemma** - Presenting only two options when more exist
- **slippery_slope** - Assuming one thing leads to extreme consequences

## 📁 Project Structure

```
.
├── manifest.json              # Chrome extension config
├── content.js                 # Content script (runs on pages)
├── background.js              # Service worker
├── popup.html                 # Extension popup UI
├── popupLogic.js             # Popup interactions
├── content.css               # Styling
├── server.js                 # Express backend
├── bridge.py                 # CSV logging server
├── package.json              # Node dependencies
│
└── Logic/
    ├── fallacy_detector.py       # 2-stage classifier (main logic)
    ├── fallacy_detector_api.py   # CLI wrapper
    ├── features.py              # TF-IDF + manual features
    ├── sentence_splitter.py      # Text preprocessing
    ├── train.py                 # Train Stage 2 model
    ├── train_stage1.py          # Train Stage 1 model
    ├── test.py                  # Basic tests
    ├── training_data.csv        # Labeled examples
    ├── req.txt                  # Python dependencies
    └── *.pkl                    # Trained models (generated)
```

## 🛠️ Development

### Run with Hot Reload
```bash
nodemon server.js
```

### Test Fallacy Detector
```bash
cd Logic
python fallacy_detector_api.py "Your text here"
```

### Check Model Performance
```bash
cd Logic
python train.py    # Shows classification report
```

## 🐛 Troubleshooting

### Models not found error
```bash
cd Logic && python train_stage1.py && python train.py
```

### Extension not connecting to server
- Verify server is running: `curl http://localhost:3000/health`
- Check browser console for errors (Ctrl+Shift+J)
- Ensure manifest.json includes `http://localhost:3000/*` in CSP

### Server crashes
- Models might not be trained
- Check Python errors: `python Logic/fallacy_detector_api.py "test"`

## 📈 Model Performance

**Stage 1 (Binary Detection):**
- Accuracy: 82%
- Precision (fallacy): 94%
- Recall (fallacy): 82%

**Stage 2 (Classification):**
- Accuracy: 58% (challenging multi-class problem)
- Best performance: slippery_slope (84% F1)

*Note: Performance improves with more labeled training data*

## 🤝 Hackathon Tips

1. **Quick Demos** - Highlight text with obvious fallacies like:
   - "You must be stupid because you disagree with me" (ad_hominem)
   - "If we allow abortion, soon we'll allow infanticide" (slippery_slope)

2. **Improve Models** - Get more training data:
   - Label more fallacy examples in `training_data.csv`
   - Re-run `train_stage1.py` and `train.py`

3. **Add Features** - Easy wins:
   - Export highlights to CSV
   - Share highlights via URL/QR code
   - Keyboard shortcuts
   - Custom color themes

4. **Performance** - Cache results, batch API calls for speed

## 📝 License

ISC

---

**Good luck! 🚀**
