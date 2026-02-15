#!/usr/bin/env python3
"""
Fallacy Detector API - Callable from CLI or import
Usage: python3 fallacy_detector_api.py "Your text here"
"""

import sys
import json
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    if len(sys.argv) < 2:
        result = {
            "error": "No text provided",
            "usage": "python3 fallacy_detector_api.py 'Your text here'"
        }
        print(json.dumps(result))
        sys.exit(1)
    
    text = sys.argv[1]
    
    try:
        from fallacy_detector import detect_fallacy
        result = detect_fallacy(text)
        print(json.dumps(result))
    except FileNotFoundError as e:
        # Models not trained yet
        result = {
            "sentence": text,
            "fallacy": "no_fallacy",
            "confidence": 0.0,
            "warning": f"Models not found: {str(e)}. Please run: python3 Logic/train.py"
        }
        print(json.dumps(result))
    except Exception as e:
        result = {
            "error": str(e),
            "sentence": text
        }
        print(json.dumps(result), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
