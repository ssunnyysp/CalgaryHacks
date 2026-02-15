from fallacy_detector import detect_fallacy
from sentence_splitter import split_sentences

paragraph = "You're wrong because you clearly don't understand science. If we allow this, everyone will cheat."

sentences = split_sentences(paragraph)
for s in sentences:
    print(detect_fallacy(s))
