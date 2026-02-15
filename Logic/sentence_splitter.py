import re

def split_sentences(paragraph):
    sentences = re.split(r'(?<=[.!?]) +', paragraph)
    return [s.strip() for s in sentences if s.strip()]
