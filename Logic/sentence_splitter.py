import re

def split_into_sentences(text: str):
    text = text.strip()
    if not text:
        return []

    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if len(s.split()) > 3]
