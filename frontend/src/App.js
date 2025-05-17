import { useState, useEffect, useRef } from "react";
import "./App.css";
import axios from "axios";
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  // State for single text to speech
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [speed, setSpeed] = useState(1.0);
  const [model, setModel] = useState("tts-1");
  const [singleAudioUrl, setSingleAudioUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const audioRef = useRef(null);

  // State for batch text to speech
  const [batchTexts, setBatchTexts] = useState([
    { text: "", voice: "alloy", filename: "speech_1", speed: 1.0, model: "tts-1" }
  ]);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [activeTab, setActiveTab] = useState("single");
  const [availableVoices, setAvailableVoices] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);

  // Fetch available voices and models on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [voicesResponse, modelsResponse] = await Promise.all([
          axios.get(`${API}/voices`),
          axios.get(`${API}/models`)
        ]);
        
        setAvailableVoices(voicesResponse.data);
        setAvailableModels(modelsResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Handle single text-to-speech generation
  const handleSingleGenerate = async () => {
    if (!text.trim()) {
      alert("Please enter some text to convert to speech");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post(
        `${API}/tts/single`,
        { text, voice, speed, model },
        { responseType: 'blob' }
      );

      const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(audioBlob);
      
      // Revoke previous URL to avoid memory leaks
      if (singleAudioUrl) {
        URL.revokeObjectURL(singleAudioUrl);
      }
      
      setSingleAudioUrl(url);
      
      // Play audio automatically
      if (audioRef.current) {
        audioRef.current.load();
        audioRef.current.play();
      }
    } catch (error) {
      console.error("Error generating speech:", error);
      alert("Error generating speech. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle batch text-to-speech generation
  const handleBatchGenerate = async () => {
    // Validate input
    const emptyTexts = batchTexts.filter(item => !item.text.trim());
    if (emptyTexts.length > 0) {
      alert("Please fill in all text fields");
      return;
    }

    setIsGeneratingBatch(true);
    try {
      const response = await axios.post(
        `${API}/tts/batch`,
        { texts: batchTexts },
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], { type: 'application/zip' });
      saveAs(blob, 'speech_files.zip');
    } catch (error) {
      console.error("Error generating batch speech:", error);
      alert("Error generating batch speech. Please try again.");
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // Add a new text field to batch generation
  const addBatchText = () => {
    setBatchTexts([
      ...batchTexts,
      { text: "", voice: "alloy", filename: `speech_${batchTexts.length + 1}` }
    ]);
  };

  // Remove a text field from batch generation
  const removeBatchText = (index) => {
    if (batchTexts.length === 1) {
      return; // Keep at least one item
    }
    const newTexts = [...batchTexts];
    newTexts.splice(index, 1);
    // Update filenames to maintain consistent numbering
    const updatedTexts = newTexts.map((item, idx) => ({
      ...item,
      filename: `speech_${idx + 1}`
    }));
    setBatchTexts(updatedTexts);
  };

  // Update a specific field in batch texts
  const updateBatchText = (index, field, value) => {
    const newTexts = [...batchTexts];
    newTexts[index][field] = value;
    setBatchTexts(newTexts);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <header className="py-6">
          <h1 className="text-4xl font-bold text-center text-blue-600">
            Text to Speech Generator
          </h1>
          <p className="text-center text-gray-600 mt-2">
            Convert your text to natural-sounding speech using OpenAI
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-md shadow-sm">
            <button
              className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                activeTab === "single"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab("single")}
            >
              Single Text
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${
                activeTab === "batch"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab("batch")}
            >
              Batch Processing
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Single Text to Speech */}
          {activeTab === "single" && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Single Text to Speech</h2>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Select Voice</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                >
                  {availableVoices.map((voiceOption) => (
                    <option key={voiceOption.id} value={voiceOption.id}>
                      {voiceOption.name} - {voiceOption.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Enter Text</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="5"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter the text you want to convert to speech..."
                ></textarea>
              </div>
              <button
                className={`w-full py-2 px-4 rounded-md font-medium ${
                  isGenerating
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
                onClick={handleSingleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Generate Speech"}
              </button>

              {/* Audio Player */}
              {singleAudioUrl && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Generated Audio</h3>
                  <audio
                    ref={audioRef}
                    className="w-full"
                    controls
                    src={singleAudioUrl}
                  >
                    Your browser does not support the audio element.
                  </audio>
                  <div className="mt-2 flex justify-end">
                    <a
                      href={singleAudioUrl}
                      download="speech.mp3"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Download Audio
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Batch Text to Speech */}
          {activeTab === "batch" && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Batch Text to Speech</h2>
              <p className="text-gray-600 mb-4">
                Add multiple texts to generate a zip file containing all the
                audio files.
              </p>

              {batchTexts.map((item, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-md mb-4"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">Text #{index + 1}</h3>
                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => removeBatchText(index)}
                      disabled={batchTexts.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mb-2">
                    <label className="block text-gray-700 mb-1 text-sm">
                      Filename (without extension)
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={item.filename}
                      onChange={(e) =>
                        updateBatchText(index, "filename", e.target.value)
                      }
                      placeholder="Enter filename (e.g. welcome_message)"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="block text-gray-700 mb-1 text-sm">
                      Voice
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={item.voice}
                      onChange={(e) =>
                        updateBatchText(index, "voice", e.target.value)
                      }
                    >
                      {availableVoices.map((voiceOption) => (
                        <option key={voiceOption.id} value={voiceOption.id}>
                          {voiceOption.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">
                      Text
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      value={item.text}
                      onChange={(e) =>
                        updateBatchText(index, "text", e.target.value)
                      }
                      placeholder="Enter the text you want to convert to speech..."
                    ></textarea>
                  </div>
                </div>
              ))}

              <div className="mb-4">
                <button
                  className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 rounded-md font-medium text-gray-700"
                  onClick={addBatchText}
                >
                  + Add Another Text
                </button>
              </div>

              <button
                className={`w-full py-2 px-4 rounded-md font-medium ${
                  isGeneratingBatch
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
                onClick={handleBatchGenerate}
                disabled={isGeneratingBatch}
              >
                {isGeneratingBatch
                  ? "Generating Batch..."
                  : "Generate & Download Zip"}
              </button>
            </div>
          )}
        </div>

        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>
            Uses OpenAI's Text-to-Speech API to generate high-quality audio from
            text
          </p>
          <p className="mt-1">
            &copy; {new Date().getFullYear()} Text to Speech Generator
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
