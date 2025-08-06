# 🇸🇪 APPEN - Immersive Swedish Conversation Practice

> A modern web application designed for Swedish learners to break through the speaking barrier and build confidence. **Practice real-time, scenario-based conversations with an interactive partner, get instant feedback with speech recognition, and learn pronunciation from lifelike audio synthesis. As a web app, it works seamlessly across all your devices, including iOS, Android, and desktop computers.**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/licenses/MIT)
[![Python Version](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Framework](https://img.shields.io/badge/framework-FastAPI-green)](https://fastapi.tiangolo.com/)

---

![App Screenshot Placeholder](https://placehold.co/800x600/1E88E5/FFFFFF?text=App+Screenshot+Here)
*(A placeholder for your application's screenshot)*

## ✨ Why APPEN?

Unlike traditional language apps, APPEN is engineered for a superior user experience and technical excellence, offering several key advantages:

* **⚡️ Blazing-Fast Response**: Utilizes an innovative **two-step response mechanism**. User speech is instantly transcribed to text on the screen, eliminating the anxious wait for a response and providing unparalleled real-time feedback.
* **🚀 Lightweight & High-Performance**: The frontend is built entirely with **Vanilla JavaScript**, free from heavy frameworks. This ensures lightning-fast load times and a smooth, responsive experience, even on mobile devices or poor network conditions.
* **🌐 Zero-Installation, Cross-Platform**: As a pure web application, there's no need for app store downloads. Users can start practicing instantly with just a link on any device (phone, tablet, or desktop). This also simplifies deployment, with no need for platform-specific packaging.
* **💪 Highly Available Backend**: The backend intelligently integrates **dual language model APIs** with a primary/fallback strategy. If one service is unstable, the system automatically switches to the other, dramatically increasing reliability.
* **🧠 Smart Caching System**: By intelligently caching dynamically generated dialogues and audio, the application minimizes redundant API calls. This not only reduces operational costs but also significantly speeds up responses for recurring requests.
* **📱 Native App-Like Experience (PWA)**: As a full-featured **Progressive Web App**, APPEN can be "installed" on a user's home screen and supports offline access to core features, offering the convenience of a native application.

## Core Features

* 🤖 **Interactive Realistic Conversations**: Engage in smooth, natural conversations with an intelligent conversation partner that can adapt to various roles.
* 🗣️ **Instant Speech Recognition**: Utilizes advanced speech-to-text models to accurately transcribe the user's spoken Swedish.
* 🎧 **Lifelike Audio Synthesis**: The partner's responses are delivered with clear, natural-sounding Swedish audio, helping learners master pronunciation and intonation.
* 🎯 **Adaptive CEFR Levels**: Supports proficiency levels from A1 (Beginner) to B2 (Upper-Intermediate), with the vocabulary and grammar adjusting accordingly.
* ✍️ **Custom Practice Scenarios**: In addition to random scenarios, users can create their own situations to practice specific topics.

## 💻 Tech Stack

| Category  | Technologies & Models                                                                                                   |
| :-------- | :------------------------------------------------------------------------------------------------------------- |
| **Backend** | `Python 3.8+`, `FastAPI`, `Uvicorn`, `PyTorch`, `Pydub`<br>**STT Model:** `KBLab/kb-whisper-small`<br>**TTS Model:** `facebook/mms-tts-swe`<br>**LLMs:** `Google Gemini API`, `DeepSeek API` |
| **Frontend**| `Vanilla JavaScript (ES6)`, `HTML5`, `CSS3`, `MediaRecorder API`, `Web Audio API`                                |
| **PWA** | `Service Workers`, `Web App Manifest`                                                                          |

## 🗺️ Future Roadmap

We are committed to evolving APPEN into a comprehensive language learning toolkit. Here are the features planned for future releases:

### 📚 Smart Dictionary & Vocabulary Review
* **Instant Look-up**: Long-press any word in the dialogue to view its Swedish-English translation and hear its pronunciation.
* **Pronunciation Guide**: A dedicated play button next to each word for standard pronunciation.
* **Efficient Review System**: A vocabulary review module inspired by spaced repetition systems (SRS) like Anki, using flashcards to reinforce memory.
* **Personalized Word Lists**: Allow users to mark words as "mastered" or "learning" to create customized study decks.

### 🎭 Enhanced Scenario Practice
* **Follow-and-Read Mode**: In the example dialogue, users can click each sentence to practice reading it aloud, with the app providing pronunciation feedback.
* **Key Expression Analysis**: Automatically extract and explain key phrases and idiomatic expressions from the dialogue, with detailed translations.
* **Comprehensive Language Coach**: After each practice session, generate a detailed performance report covering grammar, vocabulary, fluency, and areas for improvement.

### 📸 Visual Learning Tools
* **Scan & Translate**: Use the device's camera to scan real-world text (e.g., on menus or signs) and provide instant translations. Support for cropping or selecting specific text areas.
* **Text-to-Speech for Scans**: Generate audio for the recognized text, with adjustable playback speed, turning any visible text into a listening exercise.

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

* **Anaconda** or **Miniconda**
* Python 3.10 or higher
* `git` for cloning the repository

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/zhugt2019/APPEN.git](https://github.com/zhugt2019/APPEN.git)
    cd APPEN
    ```

2.  **Set up the Backend Environment with Anaconda:**
    ```sh
    # Navigate to the backend directory
    cd backend

    # Create a new conda environment named 'appen' with Python 3.10
    conda create --name appen python=3.10 -y

    # Activate the new environment
    conda activate appen

    # Install the required Python packages
    pip install -r requirements.txt

3.  **Configure Environment Variables:**
    The application reads API keys as environment variables. You can set them in one of two ways:

    **Method A (Recommended): Use a `.env` file**
    Create a `backend/.env` file and add your API keys. This method is ideal for local development.
    ```env
    # backend/.env
    GEMINI_API_KEY="YOUR_GOOGLE_GEMINI_API_KEY"
    DEEPSEEK_API_KEY="YOUR_DEEPSEEK_API_KEY"
    ```

    **Method B: Use System Environment Variables**
    Alternatively, you can set these as system-wide environment variables. The application will automatically detect them if the `.env` file is not present or if the keys are not defined there. This is common for production deployments.

4.  **Run the Application:**
    You will need two terminal windows open.

    **In your first terminal (from the `backend` directory):**
    Start the main application server.
    ```sh
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload
    ```

    **In your second terminal:**
    Use `ngrok` to expose your local server to the internet. This provides a public URL that you can access from any device, which is essential for testing on mobile.
    ```sh
    ngrok http 8000
    ```
    Copy the public URL provided by ngrok (e.g., `https://random-string.ngrok-free.app`) and open it in your browser to start practicing!

## 📜 License

Distributed under the Apache License. See `LICENSE` for more information.

## 🙏 Acknowledgements

* [FastAPI](https://fastapi.tiangolo.com/)
* [Hugging Face Transformers](https://huggingface.co/docs/transformers/index)
* [Pydub](https://github.com/jiaaro/pydub)
