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
  const [customVoicePrompt, setCustomVoicePrompt] = useState("");
  const [useCustomVoice, setUseCustomVoice] = useState(false);
  const [singleAudioUrl, setSingleAudioUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const audioRef = useRef(null);

  // State for batch text to speech
  const [batchInputText, setBatchInputText] = useState('');
  const [batchCustomVoicePrompt, setBatchCustomVoicePrompt] = useState("");
  const [useBatchCustomVoice, setUseBatchCustomVoice] = useState(false);
  const [batchVoice, setBatchVoice] = useState("alloy");
  const [batchSpeed, setBatchSpeed] = useState(1.0);
  const [batchModel, setBatchModel] = useState("tts-1");
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
      // Prepare request payload
      const payload = {
        text,
        speed,
        model
      };
      
      // Add voice or custom prompt based on selection
      if (useCustomVoice && customVoicePrompt.trim()) {
        payload.custom_voice_prompt = customVoicePrompt;
      } else {
        payload.voice = voice;
      }
      
      const response = await axios.post(
        `${API}/tts/single`,
        payload,
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

  // Parse comma-separated quoted values
  const parseBatchInput = (input) => {
    if (!input.trim()) return [];
    
    const texts = [];
    let currentFileName = 1;
    
    // Simple regex to match text in quotes (either " or ')
    const regex = /"([^"]*)"|'([^']*)'/g;
    let match;
    
    while ((match = regex.exec(input)) !== null) {
      // match[1] will be the text inside double quotes, match[2] for single quotes
      const text = match[1] || match[2];
      texts.push({
        text,
        voice: batchVoice,
        filename: `speech_${currentFileName}`,
        speed: batchSpeed,
        model: batchModel,
        custom_voice_prompt: useBatchCustomVoice ? batchCustomVoicePrompt : ""
      });
      currentFileName++;
    }
    
    return texts;
  };

  // Handle batch text-to-speech generation
  const handleBatchGenerate = async () => {
    // Parse the input text to get the array of speech items
    const parsedTexts = parseBatchInput(batchInputText);
    
    // Validate input
    if (parsedTexts.length === 0) {
      alert("Please enter at least one text item in quotes (e.g. \"Hello world\")");
      return;
    }

    setIsGeneratingBatch(true);
    try {
      const response = await axios.post(
        `${API}/tts/batch`,
        { 
          texts: parsedTexts,
          use_custom_prompt: useBatchCustomVoice
        },
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
              
              {/* Voice Selection Toggle */}
              <div className="mb-4">
                <div className="flex items-center">
                  <input
                    id="use-predefined-voice"
                    type="radio"
                    checked={!useCustomVoice}
                    onChange={() => setUseCustomVoice(false)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="use-predefined-voice" className="ml-2 block text-gray-700">
                    Use Predefined Voice
                  </label>
                </div>
                <div className="flex items-center mt-2">
                  <input
                    id="use-custom-voice"
                    type="radio"
                    checked={useCustomVoice}
                    onChange={() => setUseCustomVoice(true)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="use-custom-voice" className="ml-2 block text-gray-700">
                    Use Custom Voice Prompt
                  </label>
                </div>
              </div>
              
              {/* Predefined Voice Controls */}
              {!useCustomVoice && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
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
                  <div>
                    <label className="block text-gray-700 mb-2">Select Model</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      {availableModels.map((modelOption) => (
                        <option key={modelOption.id} value={modelOption.id}>
                          {modelOption.name} - {modelOption.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              {/* Custom Voice Prompt */}
              {useCustomVoice && (
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Custom Voice Prompt
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    value={customVoicePrompt}
                    onChange={(e) => setCustomVoicePrompt(e.target.value)}
                    placeholder="Describe the voice you want (e.g. 'A deep male voice with a British accent' or 'An enthusiastic female voice that sounds like a news anchor')"
                  ></textarea>
                  <p className="text-sm text-gray-500 mt-1">
                    Note: Custom voice is experimental and may not work with all descriptions.
                  </p>
                </div>
              )}
              
              {/* Common Controls */}
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Speech Speed ({speed}x)
                </label>
                <input
                  type="range"
                  min="0.25"
                  max="4.0"
                  step="0.05"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Slower (0.25x)</span>
                  <span>Normal (1x)</span>
                  <span>Faster (4x)</span>
                </div>
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
                Enter multiple texts as comma-separated values with each text in quotes.
              </p>
              
              {/* Voice Selection Toggle */}
              <div className="mb-4">
                <div className="flex items-center">
                  <input
                    id="batch-use-predefined-voice"
                    type="radio"
                    checked={!useBatchCustomVoice}
                    onChange={() => setUseBatchCustomVoice(false)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="batch-use-predefined-voice" className="ml-2 block text-gray-700">
                    Use Predefined Voice
                  </label>
                </div>
                <div className="flex items-center mt-2">
                  <input
                    id="batch-use-custom-voice"
                    type="radio"
                    checked={useBatchCustomVoice}
                    onChange={() => setUseBatchCustomVoice(true)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="batch-use-custom-voice" className="ml-2 block text-gray-700">
                    Use Custom Voice Prompt
                  </label>
                </div>
              </div>
              
              {/* Predefined Voice Controls */}
              {!useBatchCustomVoice && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Select Voice</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={batchVoice}
                      onChange={(e) => setBatchVoice(e.target.value)}
                    >
                      {availableVoices.map((voiceOption) => (
                        <option key={voiceOption.id} value={voiceOption.id}>
                          {voiceOption.name} - {voiceOption.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-2">Select Model</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={batchModel}
                      onChange={(e) => setBatchModel(e.target.value)}
                    >
                      {availableModels.map((modelOption) => (
                        <option key={modelOption.id} value={modelOption.id}>
                          {modelOption.name} - {modelOption.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              {/* Custom Voice Prompt */}
              {useBatchCustomVoice && (
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">
                    Custom Voice Prompt
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    value={batchCustomVoicePrompt}
                    onChange={(e) => setBatchCustomVoicePrompt(e.target.value)}
                    placeholder="Describe the voice you want (e.g. 'A deep male voice with a British accent' or 'An enthusiastic female voice that sounds like a news anchor')"
                  ></textarea>
                  <p className="text-sm text-gray-500 mt-1">
                    Note: Custom voice is experimental and may not work with all descriptions.
                  </p>
                </div>
              )}
              
              {/* Common Controls */}
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Speech Speed ({batchSpeed}x)
                </label>
                <input
                  type="range"
                  min="0.25"
                  max="4.0"
                  step="0.05"
                  value={batchSpeed}
                  onChange={(e) => setBatchSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Slower (0.25x)</span>
                  <span>Normal (1x)</span>
                  <span>Faster (4x)</span>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Enter Quoted Text Items</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="5"
                  value={batchInputText}
                  onChange={(e) => setBatchInputText(e.target.value)}
                  placeholder="Enter texts in quotes, separated by commas. Example: 'Hello world', 'This is another text', 'Third example'"
                ></textarea>
                <div className="text-sm text-gray-500 mt-1">
                  <p>Format: Each text must be enclosed in quotes (either " or ') and separated by commas.</p>
                  <p>Example: "First text", "Second text", 'Third text with single quotes'</p>
                </div>
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