import streamlit as st
from fallacy_detector import detect_fallacies

st.set_page_config(page_title="Logic Gatekeeper", layout="centered")
st.title("🧠 Logic Gatekeeper (Rule-Based)")
st.write("Detect logical fallacies and get critical thinking prompts.")

text = st.text_area("Paste a statement or argument:", height=150)

if st.button("Analyze"):
    if not text.strip():
        st.warning("Please enter some text.")
    else:
        results = detect_fallacies(text)
        for r in results:
            st.subheader(f"Fallacy Detected: {r['fallacy'].title()}")
            if r["matched_phrase"]:
                st.markdown(f"**Matched phrase:** `{r['matched_phrase']}`")
            st.markdown("**Explanation:**")
            st.write(r["explanation"])
            st.markdown("**Critical Thinking Prompt:**")
            st.info(r["prompt"])
