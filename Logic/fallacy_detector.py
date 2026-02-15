import re

FALLACIES = {
    "ad hominem": {
        "patterns": [
            r"you['’]?re wrong because",
            r"you (are|'re) (an |a )?(idiot|stupid|moron|fool|ignorant)",
            r"obviously you",
            r"as if you",
            r"you clearly"
        ],
        "explanation": "Attacks the person making the argument rather than the argument itself.",
        "prompt": "What evidence supports or refutes the claim independently of the speaker?"
    },
    "strawman": {
        "patterns": [
            r"so basically you['’]?re saying",
            r"what you mean is",
            r"you're exaggerating",
            r"you're twisting my words"
        ],
        "explanation": "Misrepresents an opposing argument to make it easier to attack.",
        "prompt": "Is this responding to the original argument or a distorted version of it?"
    },
    "slippery slope": {
        "patterns": [
            r"if .* happens, then .* will happen",
            r"this will inevitably lead to",
            r"before you know it",
            r"it will snowball into"
        ],
        "explanation": "Assumes a small step will inevitably lead to extreme consequences.",
        "prompt": "What evidence shows this chain of events must occur?"
    },
    "false dilemma": {
        "patterns": [
            r"either .* or .*",
            r"there are only two options",
            r"you must choose between",
            r"nothing else is possible"
        ],
        "explanation": "Presents only two options when more possibilities exist.",
        "prompt": "Are there reasonable alternatives being ignored?"
    }
}

def detect_fallacies(text):
    # Normalize text: lowercase and standardize quotes
    text_lower = text.lower().replace("’", "'")

    detected = []

    for fallacy, info in FALLACIES.items():
        for pattern in info["patterns"]:
            match = re.search(pattern, text_lower)
            if match:
                detected.append({
                    "fallacy": fallacy,
                    "matched_phrase": match.group(0),
                    "explanation": info["explanation"],
                    "prompt": info["prompt"]
                })
                break  # Avoid multiple matches for same fallacy

    if not detected:
        detected.append({
            "fallacy": "no fallacy",
            "matched_phrase": "",
            "explanation": "No obvious logical fallacy detected.",
            "prompt": "What assumptions does this argument rely on?"
        })

    return detected
