import React, { useState, useRef, useEffect } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, logout } from "./services/firebase";
import { 
  analyzeScript, 
  AnalysisResult, 
  generateFrameImage,
  generateGridImage,
  Character,
  Scene,
  Prop,
  StoryboardFrame,
  ReferenceImage
} from "./services/gemini";
import { 
  Card, 
  Badge, 
  SectionTitle 
} from "./components/UI";
import { extractTextFromFile } from "./lib/extract";
import { StoryboardFrameCard } from "./components/StoryboardFrameCard";
import { LoginModal } from "./components/LoginModal";
import { 
  Film, 
  Users, 
  MapPin, 
  Package, 
  Sparkles, 
  Send, 
  Image as ImageIcon, 
  X,
  Plus,
  Loader2,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  FileText,
  ListTree,
  Eye,
  EyeOff,
  User,
  LogIn,
  LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [script, setScript] = useState("");
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [frameImages, setFrameImages] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"analysis" | "storyboard">("analysis");
  const [generatingMetaImage, setGeneratingMetaImage] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);
  
  // Render Parameters
  const [layoutMode, setLayoutMode] = useState("智能自动");
  const [promptWeight, setPromptWeight] = useState("1.0");
  const [samplerName, setSamplerName] = useState("euler");
  const [samplingSteps, setSamplingSteps] = useState("10");

  const [analysisProgress, setAnalysisProgress] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setAnalysisProgress(0);
      interval = setInterval(() => {
        setAnalysisProgress(p => (p < 95 ? p + 1 : p));
      }, 300);
    } else {
      setAnalysisProgress(100);
      setTimeout(() => setAnalysisProgress(0), 500); // reset after a delay
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const buildPromptWithLayout = (basePrompt: string) => {
    return layoutMode !== "智能自动" ? `[${layoutMode}] ${basePrompt}` : basePrompt;
  };

  const currentSamplerConfig = {
    promptWeight,
    samplerName,
    steps: samplingSteps
  };

  const generateMetaImage = async (type: 'character' | 'scene' | 'prop', item: any, index: number) => {
    const key = `${type}-${index}`;
    setGeneratingMetaImage(key);
    try {
      let prompt = "";
      if (type === 'character') {
        prompt = `Character Concept Art: ${item.name}. ${item.description}. Wearing: ${item.clothing}. Makeup/Style: ${item.makeup}. Professional character design sheet, neutral background, centered subject, highly detailed.`;
      } else if (type === 'scene') {
        prompt = `Environment Concept Art: ${item.name}. Setting: ${item.setting}. Lighting: ${item.lighting}. Atmosphere: ${item.atmosphere}. Establishing shot, cinematic lighting, highly detailed environment design.`;
      } else if (type === 'prop') {
        prompt = `Prop Design Concept Art: ${item.name}. Description: ${item.description}. Usage context: ${item.usage}. Clear product shot, isolated on neutral background, highly detailed asset design.`;
      }
      
      prompt = buildPromptWithLayout(prompt);

      let url;
      if (selectedEngine === "comfyui") {
        const { generateComfyUIFrame } = await import("./services/gemini");
        const urls = await generateComfyUIFrame(
          comfyUrl,
          comfyWorkflow,
          comfyNodeId,
          prompt,
          customStyle || globalStyle,
          false,
          currentSamplerConfig
        );
        url = urls[0];
      } else {
        url = await generateFrameImage(
          prompt,
          isHighQuality,
          globalStyle,
          getProjectContext(),
          "16:9",
          customApiKey
        );
      }
      
      setReferenceImages(prev => [...prev, {
        id: Math.random().toString(36).substring(7),
        url: url,
        name: `${item.name} 设定图`
      }]);
    } catch (err) {
      console.error(err);
      alert(`生成${item.name}的设定图失败: ` + String(err));
    } finally {
      setGeneratingMetaImage(null);
    }
  };

  const updateCharacter = (index: number, field: keyof Character, value: string) => {
    if (!results) return;
    const newChars = [...results.characters];
    newChars[index] = { ...newChars[index], [field]: value };
    setResults({ ...results, characters: newChars });
  };

  const updateScene = (index: number, field: keyof Scene, value: string) => {
    if (!results) return;
    const newScenes = [...results.scenes];
    newScenes[index] = { ...newScenes[index], [field]: value };
    setResults({ ...results, scenes: newScenes });
  };

  const updateProp = (index: number, field: keyof Prop, value: string) => {
    if (!results) return;
    const newProps = [...results.props];
    newProps[index] = { ...newProps[index], [field]: value };
    setResults({ ...results, props: newProps });
  };

  const updateStoryboardFrame = (index: number, field: keyof StoryboardFrame, value: string | number) => {
    if (!results) return;
    const newStoryboard = [...results.storyboard];
    newStoryboard[index] = { ...newStoryboard[index], [field]: value };
    setResults({ ...results, storyboard: newStoryboard });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isHighQuality, setIsHighQuality] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [globalStyle, setGlobalStyle] = useState("Cinematic Movie");
  const [customStyle, setCustomStyle] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("1080P");
  
  // Analysis Engine configurations
  const [analysisEngine, setAnalysisEngine] = useState<"gemini" | "ollama">("gemini");
  const [analysisOllamaUrl, setAnalysisOllamaUrl] = useState("http://127.0.0.1:11434");
  const [analysisOllamaModel, setAnalysisOllamaModel] = useState("qwen:latest");

  // Image Generation Engine configurations
  const [selectedEngine, setSelectedEngine] = useState<"gemini" | "comfyui">("gemini");
  const [comfyUrl, setComfyUrl] = useState("http://127.0.0.1:8188");
  const [comfyNodeId, setComfyNodeId] = useState("6");
  const [comfyBatchMode, setComfyBatchMode] = useState(false);
  const [comfyBatchSeparator, setComfyBatchSeparator] = useState("\\n\\n");
  const [comfyWorkflow, setComfyWorkflow] = useState(`{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 12345,
      "steps": 20,
      "cfg": 8,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    }
  },
  "4": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "v1-5-pruned-emaonly.ckpt"
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "batch_size": 1,
      "width": 512,
      "height": 512
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "masterpiece, best quality, cinematic",
      "clip": ["4", 1]
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "bad hands, text, error, missing fingers, extra digit",
      "clip": ["4", 1]
    }
  },
  "8": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["3", 0],
      "vae": ["4", 2]
    }
  },
  "9": {
    "class_type": "SaveImage",
    "inputs": {
      "filename_prefix": "ScriptWise",
      "images": ["8", 0]
    }
  }
}`);

  const [previewFrameIndex, setPreviewFrameIndex] = useState<number | null>(null);
  const [gridPage, setGridPage] = useState(0);
  const [isGridExporting, setIsGridExporting] = useState(false);
  const [gridImageUrls, setGridImageUrls] = useState<Record<number, string[]>>({});
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [rawAnalysisText, setRawAnalysisText] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const styleOptions = [
    { label: "电影感", value: "电影感镜头, 8k, 高度细节, 电影光效" },
    { label: "动漫", value: "动漫风格, 色彩鲜艳, 表现力强" },
    { label: "黑色电影", value: "黑色电影风格, 黑白, 戏剧性阴影" },
    { label: "素描", value: "铅笔素描, 手绘概念图" },
    { label: "赛博朋克", value: "赛博朋克风格, 霓虹灯, 高科技感" },
    { label: "油画", value: "油画风格, 质感笔触" },
  ];

  const aspectRatios = [
    { label: "21:9", value: "21:9" },
    { label: "16:9", value: "16:9" },
    { label: "4:3", value: "4:3" },
    { label: "9:16", value: "9:16" },
  ];

  const resolutions = [
    { label: "720P", value: "720P" },
    { label: "960P", value: "960P" },
    { label: "1080P", value: "1080P" },
    { label: "2160P", value: "2160P" },
  ];

  const handleFileChange = (e: any) => {
    const files = Array.from((e.target.files as FileList) || []);
    processImageFiles(files);
  };

  const processImageFiles = (files: File[]) => {
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImages(prev => [...prev, {
          id: Math.random().toString(36).substring(7),
          url: reader.result as string,
          name: file.name.split('.')[0] || "Ref"
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleScriptDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length === 0) return;
    
    setIsExtractingDoc(true);
    try {
      const texts = await Promise.all(files.map((f: File) => extractTextFromFile(f)));
      setScript(prev => prev + (prev ? '\n\n' : '') + texts.join('\n\n'));
    } catch (err) {
      console.error(err);
      alert("文档解析失败，暂不支持该格式或文件已损坏。");
    } finally {
      setIsExtractingDoc(false);
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    processImageFiles(files);
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleWorkflowUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setComfyWorkflow(JSON.stringify(json, null, 2));
      } catch (err) {
        alert("JSON 文件解析失败，请确保您上传的是 ComfyUI 导出的 API 格式 JSON 文件。");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

  const onAnalyze = async () => {
    if (!script.trim()) return;
    setIsAnalyzing(true);
    setRawAnalysisText("");
    try {
      let res;
      if (analysisEngine === "ollama") {
        const { analyzeOllamaScript } = await import("./services/gemini");
        const analysisResult = await analyzeOllamaScript(
          analysisOllamaUrl,
          analysisOllamaModel,
          script
        );
        if (analysisResult.parsed) {
          res = analysisResult.parsed;
          setResults(res);
        } else {
          setRawAnalysisText(analysisResult.text);
          setResults(null);
        }
      } else {
        res = await analyzeScript(script, referenceImages.map(img => img.url), customApiKey);
        setResults(res);
      }
      setActiveTab("analysis");
    } catch (error: any) {
      console.error("Analysis failed", error);
      const errorMsg = JSON.stringify(error) + String(error);
      if (errorMsg.includes("429")) {
        alert("额度受限 (429): 当前分析模型的免费额度已耗尽。请配置有效 API Key。");
      } else if (errorMsg.includes("403")) {
        alert("权限不足 (403): 请检查 API Key。");
      } else {
        alert(`智能剧本分析失败: \n${error?.message || "未知错误，请检查网络或配置"}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoSplit = () => {
    if (!rawAnalysisText) return;
    
    // Default fallback structure
    const result: AnalysisResult = {
      characters: [], props: [], scenes: [], storyboard: []
    };

    // Advanced Rescue: Regex approach to extract frames manually from unstructured markdown/list
    const frameRegex = /(?:分镜|镜头|第|Frame|Shot)\s*([0-9]+)\s*(?:镜|:|：|>|-)?\s*([\s\S]*?)(?=(?:分镜|镜头|第|Frame|Shot)\s*[0-9]+\s*(?:镜|:|：|>|-)?|$)/gi;
    let match;
    let foundFrames = false;

    while ((match = frameRegex.exec(rawAnalysisText)) !== null) {
      foundFrames = true;
      const frameNumber = parseInt(match[1]) || (result.storyboard.length + 1);
      const descChunk = match[2].trim();
      
      let visualDesc = descChunk;
      const visualMatch = descChunk.match(/(?:画面|视觉|内容)[:：]\s*([^\n]+)/i);
      if (visualMatch) visualDesc = visualMatch[1];
      
      visualDesc = visualDesc.replace(/^[\s\S]*?(?:画面|视觉|内容)[:：]/i, '').trim();

      let audioVoiceover = "";
      const audioMatch = descChunk.match(/(?:声音|旁白|台词|VO)[:：]\s*([^\n]+)/i);
      if (audioMatch) audioVoiceover = audioMatch[1];

      result.storyboard.push({
        frameNumber: frameNumber,
        visualDescription: visualDesc || descChunk.split('\n')[0] || "自动提取画面",
        audioVoiceover: audioVoiceover,
        composition: "自动分析构图"
      });
    }

    // Secondary Fallback if explicit keywords aren't found
    if (!foundFrames) {
      const chunks = rawAnalysisText.split(/\n\s*\n/).filter(c => c.trim().length > 5);
      chunks.forEach((chunk, idx) => {
        result.storyboard.push({
          frameNumber: idx + 1,
          visualDescription: chunk.trim(),
          audioVoiceover: "",
          composition: "智能构图"
        });
      });
    }

    if (result.storyboard.length === 0) {
      result.storyboard.push({
        frameNumber: 1,
        visualDescription: rawAnalysisText.substring(0, 500),
        audioVoiceover: "",
        composition: ""
      });
    }

    setResults(result);
    setRawAnalysisText("");
  };

  const handleFrameImageGenerated = (frameNumber: number, imageUrl: string) => {
    setFrameImages(prev => ({ ...prev, [frameNumber]: imageUrl }));
  };

  const getProjectContext = () => {
    let baseContext = "";
    if (results) {
      baseContext = `
        CHARACTERS: ${results.characters.map(c => `${c.name}(${c.description}, Outfit:${c.clothing})`).join("; ")}
        EQUIPMENT/PROPS: ${results.props.map(p => `${p.name}(${p.description})`).join("; ")}
        SCENES: ${results.scenes.map(s => `${s.name}(${s.setting}, ${s.atmosphere})`).join("; ")}
      `.trim();
    }
    
    // Add reference image names to enforce consistency if they exist
    const refNames = referenceImages.map(img => img.name).filter(name => name.trim() !== "Ref" && name.trim() !== "");
    if (refNames.length > 0) {
      baseContext += `\nVISUAL EXAMPLES ESTABLISHED (Ensure consistency with these established designs): ${refNames.join(", ")}`;
    }
    return baseContext;
  };

  const generateAllFrameImages = async () => {
    if (!results || isGeneratingAll) return;
    
    const frames = results.storyboard;
    const pendingFrames = frames.filter(f => !frameImages[f.frameNumber]);
    if (pendingFrames.length === 0) return;

    setIsGeneratingAll(true);
    setGenStatus("准备开始生成...");
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // -- BATCH MODE EXPERIMENT FOR COMFYUI --
    if (selectedEngine === "comfyui" && comfyBatchMode) {
      setGenStatus(`正在批量发送请求到 ComfyUI 队列 (${pendingFrames.length}张图)...`);
      try {
        const actualSeparator = comfyBatchSeparator.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
        const combinedPrompt = pendingFrames.map(f => {
          const finalDesc = buildPromptWithLayout(f.visualDescription);
          return customStyle ? `${finalDesc}, ${globalStyle}, ${customStyle}` : `${finalDesc}, ${globalStyle}`;
        }).join(actualSeparator);

        const { generateComfyUIFrame } = await import("./services/gemini");
        const urls = await generateComfyUIFrame(
          comfyUrl,
          comfyWorkflow,
          comfyNodeId,
          combinedPrompt,
          "", // Style is already combined above
          true, // isBatchMode
          currentSamplerConfig
        );
        
        const newImages = { ...frameImages };
        urls.forEach((url, i) => {
          if (pendingFrames[i]) {
            newImages[pendingFrames[i].frameNumber] = url;
          }
        });
        setFrameImages(newImages);
      } catch (error) {
        console.error("Batch generation failed", error);
        alert(`批量生成失败: ${String(error)}。\n可能原因: 您的 ComfyUI 节点 ID 配置不正确或本地服务不可用。`);
      } finally {
        setGenStatus("");
        setIsGeneratingAll(false);
      }
      return;
    }

    // -- NORMAL 1-by-1 MODE --
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (frameImages[frame.frameNumber]) continue;
      
      setGenStatus(`正在生成第 ${i + 1}/${frames.length} 帧`);
      
      let retries = 0;
      const maxRetries = 3;

      while (retries <= maxRetries) {
        try {
          let url;
          if (selectedEngine === "comfyui") {
            const { generateComfyUIFrame } = await import("./services/gemini");
            const urls = await generateComfyUIFrame(
              comfyUrl,
              comfyWorkflow,
              comfyNodeId,
              buildPromptWithLayout(frame.visualDescription),
              customStyle || globalStyle,
              false, // isBatchMode
              currentSamplerConfig
            );
            url = urls[0];
          } else {
            url = await generateFrameImage(
              buildPromptWithLayout(frame.visualDescription), 
              isHighQuality, 
              customStyle || globalStyle,
              getProjectContext(),
              aspectRatio,
              customApiKey
            );
          }
          setFrameImages(prev => ({ ...prev, [frame.frameNumber]: url }));
          // Throttling to respect rate limits
          await sleep(3000); 
          break; // Success
        } catch (e) {
          console.error(`Failed to generate frame ${frame.frameNumber} (Attempt ${retries + 1})`, e);
          const errorMsg = JSON.stringify(e) + String(e);
          
          if (errorMsg.includes("403")) {
            setGenStatus("权限不足 - 请检查 API KEY");
            alert("PERMISSION_DENIED (403): 批量生成中断。请确保已在右上角正确配置 API Key。部分生图模型（如 Banana Pro HQ）需要使用您的自有配额 (Member Quota)。");
            break; 
          }

          if (errorMsg.includes("429")) {
            if (retries < maxRetries) {
              const backoff = Math.pow(2, retries + 1) * 10000 + Math.random() * 2000;
              setGenStatus(`频率受限 - ${Math.round(backoff/1000)}秒后重试...`);
              await sleep(backoff);
              retries++;
              continue;
            } else {
              setGenStatus("额度耗尽 - 已暂停");
              alert("QUOTA EXHAUSTED (429): 批量生成已停止。请点击右上角切换为您的个人 API Key (Member Quota) 以继续使用 Pro 会员额度。");
              break;
            }
          } else {
            setGenStatus(`失败 F${frame.frameNumber}`);
            await sleep(1000);
            break; // Give up or logic error
          }
        }
      }
    }
    setGenStatus("");
    setIsGeneratingAll(false);
  };

  const generateNineGrid = async () => {
    if (!results) return;
    setIsGridExporting(true);
    setGenStatus("正在直接生成九宫格整合大图...");

    try {
      const pageSize = 9;
      const startIndex = gridPage * pageSize;
      const currentFrames = results.storyboard.slice(startIndex, startIndex + pageSize);

      const frameData = currentFrames.map((f, i) => ({
        number: i + 1,
        description: f.visualDescription
      }));

      const combinedStyle = customStyle ? `${globalStyle}, ${customStyle}` : globalStyle;
      const url = await generateGridImage(frameData, isHighQuality, combinedStyle, getProjectContext(), aspectRatio, customApiKey);

      setGridImageUrls(prev => ({ ...prev, [gridPage]: [url, ...(prev[gridPage] || [])] }));
    } catch (error) {
      console.error("Grid generation failed", error);
      alert("九宫格生成失败。请重试，并确保已配置带有会员权限的 API Key。");
    } finally {
      setIsGridExporting(false);
      setGenStatus("");
    }
  };

  return (
    <div className="h-screen bg-[var(--bg)] text-[var(--text-main)] font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-[56px] bg-[var(--surface)] border-b border-[var(--border)] px-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-[var(--accent)] font-extrabold tracking-wider text-base uppercase">
            HACKBUTEER AGAINT <span className="font-light opacity-60">PRO</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-tight font-bold">
            Powered By DevaHoo
          </div>
          {results && (
            <div className="flex bg-[var(--bg)] p-1 rounded border border-[var(--border)]">
              <TabButton 
                active={activeTab === "analysis"} 
                onClick={() => setActiveTab("analysis")}
                label="资产分析表"
              />
              <TabButton 
                active={activeTab === "storyboard"} 
                onClick={() => setActiveTab("storyboard")}
                label="分镜矩阵图"
              />
            </div>
          )}
          
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded text-xs font-bold mr-1">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-4 h-4 rounded-full" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                <span className="hidden sm:inline max-w-[100px] truncate">{currentUser.displayName || currentUser.email}</span>
              </div>
              <button 
                onClick={() => logout()}
                className="flex items-center gap-1.5 bg-[#111] border border-[var(--border)] px-2 py-1.5 rounded hover:bg-red-900/40 hover:text-red-400 hover:border-red-900 transition-colors text-[10px] uppercase font-bold text-[var(--text-dim)]"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded hover:bg-[var(--bg)] transition-colors text-xs font-bold"
            >
              <User className="w-3 h-3" />
              <span className="hidden sm:inline">登录</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[420px] 2xl:w-[500px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col p-4 gap-6 overflow-y-auto custom-scrollbar flex-shrink-0">
          <div>
            <div className="text-sm uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-2 flex justify-between">
              <span>输入剧本/梗概</span>
              {isExtractingDoc && <span className="opacity-70 animate-pulse text-[10px] mt-0.5">解析中...</span>}
            </div>
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleScriptDrop}
              className="relative"
            >
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="在这里输入您的故事脚本，或拖拽 txt/md/pdf/docx 文档至此..."
                disabled={isExtractingDoc}
                className="w-full h-48 bg-[#111] border border-[var(--border)] rounded p-3 text-sm text-white outline-none focus:border-[var(--accent)] transition-colors resize-none font-sans leading-relaxed disabled:opacity-50"
              />
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleImageDrop}
          >
            <div className="text-sm uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-2">视觉参考图 <span className="text-xs opacity-40 font-normal">(支持拖拽)</span></div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {referenceImages.map((img, i) => (
                <div key={img.id} className="relative aspect-square rounded border border-[var(--border)] overflow-hidden group">
                  <img src={img.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5 text-[8px] text-white truncate text-center opacity-80 group-hover:opacity-0 transition-opacity pointer-events-none">
                    {img.name}
                  </div>
                  <input 
                    type="text" 
                    value={img.name}
                    title={img.name}
                    onChange={(e) => {
                      const newRef = [...referenceImages];
                      newRef[i].name = e.target.value;
                      setReferenceImages(newRef);
                    }}
                    className="absolute bottom-0 left-0 w-full bg-black/80 text-[8px] text-white px-1 py-0.5 text-center outline-none opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                  />
                  <button 
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-black/60 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white m-[2px]" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded border border-dashed border-[var(--border)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all bg-[#111]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <div className="bg-[#1a1c1f] border border-[var(--border)] p-3 rounded">
            <div className="text-sm uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-3">生成艺术风格</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {styleOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setGlobalStyle(opt.value);
                  }}
                  className={`text-sm py-1.5 border rounded transition-all font-mono uppercase ${
                    globalStyle === opt.value
                      ? "bg-[var(--accent)] text-black border-[var(--accent)] font-bold"
                      : "bg-[#111] text-[var(--text-dim)] border-[var(--border)] hover:border-[var(--text-dim)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase font-bold text-white opacity-40">自定义风格关键词</div>
              <input
                type="text"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="例如: 赛博朋克, 高对比度..."
                className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-white outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="bg-[#1a1c1f] border border-[var(--border)] p-3 rounded">
            <div className="text-sm uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-3">画面设定</div>
            <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wide mb-1.5 mt-2">画面长宽比</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {aspectRatios.map((ar) => (
                <button
                  key={ar.label}
                  onClick={() => setAspectRatio(ar.value)}
                  className={`text-sm py-1.5 px-2 border rounded transition-all font-mono uppercase flex-1 whitespace-nowrap ${
                    aspectRatio === ar.value
                      ? "bg-[var(--accent)] text-black border-[var(--accent)] font-bold"
                      : "bg-[#111] text-[var(--text-dim)] border-[var(--border)] hover:border-[var(--text-dim)]"
                  }`}
                >
                  {ar.label}
                </button>
              ))}
            </div>

            <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wide mb-1.5 mt-2 border-t border-gray-800 pt-2">分辨率</div>
            <div className="flex flex-wrap gap-2 mb-1">
              {resolutions.map((res) => (
                <button
                  key={res.label}
                  onClick={() => setResolution(res.value)}
                  className={`text-sm py-1.5 px-2 border rounded transition-all font-mono uppercase flex-1 whitespace-nowrap ${
                    resolution === res.value
                      ? "bg-[var(--accent)] text-black border-[var(--accent)] font-bold"
                      : "bg-[#111] text-[var(--text-dim)] border-[var(--border)] hover:border-[var(--text-dim)]"
                  }`}
                >
                  {res.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#1a1c1f] border border-[var(--border)] p-3 rounded mt-4">
            <div className="text-xs uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-3">工作流引擎配置</div>
            
            {/* Analysis Engine Config */}
            <div className="mb-4">
              <div className="text-[10px] text-[var(--text-dim)] uppercase font-mono tracking-widest mb-1.5 flex items-center gap-1">
                <Send className="w-3 h-3" />
                1. 智能分析引擎 (分镜转换)
              </div>
              <div className="flex gap-2 mb-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="analysis_engine" value="gemini" checked={analysisEngine === "gemini"} onChange={() => setAnalysisEngine("gemini")} className="accent-[var(--accent)]" />
                  <span className="text-xs text-white">Gemini 2.5 Pro</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="analysis_engine" value="ollama" checked={analysisEngine === "ollama"} onChange={() => setAnalysisEngine("ollama")} className="accent-[var(--accent)]" />
                  <span className="text-xs text-[var(--accent)]">本地 Ollama (大模型)</span>
                </label>
              </div>
              {analysisEngine === "ollama" && (
                <div className="space-y-2 p-2 bg-[#2a2c31] border border-[var(--border)] rounded mb-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-white opacity-60">API 地址</label>
                    <input type="text" value={analysisOllamaUrl} onChange={(e) => setAnalysisOllamaUrl(e.target.value)} className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 mt-1 text-xs text-white outline-none focus:border-[var(--accent)]" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-white opacity-60">模型名称 (Model)</label>
                    <input type="text" value={analysisOllamaModel} onChange={(e) => setAnalysisOllamaModel(e.target.value)} className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 mt-1 text-xs text-white outline-none focus:border-[var(--accent)]" />
                  </div>
                </div>
              )}
            </div>

            {/* Image Gen Engine Config */}
            <div>
              <div className="text-[10px] text-[var(--text-dim)] uppercase font-mono tracking-widest mb-1.5 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                2. 画面生成引擎 (剧照渲染)
              </div>
              <div className="flex gap-2 mb-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="radio" 
                    name="engine" 
                    value="gemini" 
                    checked={selectedEngine === "gemini"} 
                    onChange={() => setSelectedEngine("gemini")}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-xs text-white">Google Gemini (推荐)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="radio" 
                    name="engine" 
                    value="comfyui" 
                    checked={selectedEngine === "comfyui"} 
                    onChange={() => setSelectedEngine("comfyui")}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-xs text-[var(--accent)]">本地 ComfyUI</span>
                </label>
              </div>

              {selectedEngine === "comfyui" && (
                <div className="space-y-2 mt-3 p-2 bg-[#2a2c31] border border-[var(--border)] rounded">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-white opacity-60">API 地址 (需开启 --listen)</label>
                    <input
                      type="text"
                      value={comfyUrl}
                      onChange={(e) => setComfyUrl(e.target.value)}
                      className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 mt-1 text-xs text-white outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-white opacity-60">提示词 Node ID (CLIPTextEncode)</label>
                    <input
                      type="text"
                      value={comfyNodeId}
                      onChange={(e) => setComfyNodeId(e.target.value)}
                      className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 mt-1 text-xs text-white outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold text-white opacity-60">完整 Workflow (API JSON)</label>
                      <label className="text-[10px] bg-[#111] hover:bg-[var(--accent)] hover:text-black transition-colors border border-[var(--border)] rounded px-2 py-1 cursor-pointer text-[var(--accent)] font-bold">
                        加载文件...
                        <input type="file" accept=".json" className="hidden" onChange={handleWorkflowUpload} />
                      </label>
                    </div>
                    <div className="mt-1 relative group">
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent pointer-events-none rounded"></div>
                      <textarea
                        value={comfyWorkflow}
                        onChange={(e) => setComfyWorkflow(e.target.value)}
                        className="w-full h-20 bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text-dim)] outline-none focus:border-[var(--accent)] font-mono resize-none custom-scrollbar opacity-70 group-hover:opacity-100 transition-opacity"
                        placeholder="也可以直接粘贴被导出的 ComfyUI API JSON 工作流代码..."
                      />
                    </div>
                  </div>
                  
                  <div className="mt-2 pt-2 border-t border-[var(--border)] border-dashed">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-xs uppercase font-bold text-[var(--accent)] tracking-widest group-hover:text-white transition-colors">开启列表节点批量模式</span>
                      <input 
                        type="checkbox" 
                        checked={comfyBatchMode} 
                        onChange={(e) => setComfyBatchMode(e.target.checked)}
                        className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                      />
                    </label>
                    {comfyBatchMode && (
                      <div className="mt-2 text-xs">
                         <div className="flex items-center justify-between opacity-80 mb-1.5">
                           <span>多文本提示词分隔符:</span>
                           <input type="text" value={comfyBatchSeparator} onChange={(e) => setComfyBatchSeparator(e.target.value)} className="bg-[#111] text-center border border-[var(--border)] rounded px-1.5 py-0.5 min-w-[50px] text-white outline-none text-xs" />
                         </div>
                         <div className="text-[10px] text-[var(--text-dim)] mt-1.5 leading-relaxed">通过批量生成可将所有缺失图像的提示词组合发送给 Node，实现一次输出多图（需节点支持，如 easy promptList）。请确保你的 Node ID（上方）指向的是支持字符串划分的提示词列表节点。</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-sm uppercase font-bold text-white tracking-widest mb-3 mt-4 pt-4 border-t border-[var(--border)]">渲染参数</div>
            <div className="space-y-4 font-mono text-xs text-[var(--text-dim)]">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs"><span>画面景别 (Shot Type)</span></div>
                <div className="flex gap-2 text-[10px] flex-wrap">
                  {["智能自动", "远景", "全景", "中景", "近景", "特写"].map(mode => (
                    <button 
                      key={mode} 
                      onClick={() => setLayoutMode(mode)} 
                      className={`px-2 py-1 rounded border transition-colors ${layoutMode === mode ? 'bg-[var(--accent)] text-black border-[var(--accent)]' : 'bg-[#111] text-white border-[var(--border)] hover:border-[var(--accent)]'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <input 
                  type="text" 
                  value={layoutMode} 
                  onChange={(e) => setLayoutMode(e.target.value)} 
                  className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--accent)] transition-colors mt-1 block" 
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs"><span>采样步数 (Steps)</span></div>
                <div className="flex gap-2 text-[10px] flex-wrap">
                  {["10", "15", "20", "25", "30"].map(stepStr => (
                    <button 
                      key={stepStr} 
                      onClick={() => setSamplingSteps(stepStr)} 
                      className={`px-2 py-1 rounded border transition-colors ${samplingSteps === stepStr ? 'bg-[var(--accent)] text-black border-[var(--accent)]' : 'bg-[#111] text-white border-[var(--border)] hover:border-[var(--accent)]'}`}
                    >
                      {stepStr}
                    </button>
                  ))}
                </div>
                <input 
                  type="number" 
                  step="1" 
                  value={samplingSteps} 
                  onChange={(e) => setSamplingSteps(e.target.value)} 
                  className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--accent)] transition-colors mt-1 block" 
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs"><span>提示词权重 (CFG Scale)</span></div>
                <div className="flex gap-2 text-[10px] flex-wrap">
                  {["0.5", "0.7", "0.9", "1.0", "1.2", "1.5", "2.0"].map(weight => (
                    <button 
                      key={weight} 
                      onClick={() => setPromptWeight(weight)} 
                      className={`px-2 py-1 rounded border transition-colors ${promptWeight === weight ? 'bg-[var(--accent)] text-black border-[var(--accent)]' : 'bg-[#111] text-white border-[var(--border)] hover:border-[var(--accent)]'}`}
                    >
                      {weight}
                    </button>
                  ))}
                </div>
                <input 
                  type="number" 
                  step="0.1" 
                  value={promptWeight} 
                  onChange={(e) => setPromptWeight(e.target.value)} 
                  className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--accent)] transition-colors mt-1 block" 
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs"><span>采样算法 (Sampler)</span></div>
                <select 
                  value={samplerName} 
                  onChange={(e) => setSamplerName(e.target.value)} 
                  className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--accent)] transition-colors block"
                >
                  <optgroup label="Standard">
                    <option value="euler">euler</option>
                    <option value="euler_ancestral">euler_ancestral</option>
                    <option value="heun">heun</option>
                    <option value="ddpm">ddpm</option>
                    <option value="ddim">ddim</option>
                  </optgroup>
                  <optgroup label="DPM Variants">
                    <option value="dpm_2">dpm_2</option>
                    <option value="dpm_2_ancestral">dpm_2_ancestral</option>
                    <option value="dpm_fast">dpm_fast</option>
                    <option value="dpm_adaptive">dpm_adaptive</option>
                    <option value="dpmpp_2s_ancestral">dpmpp_2s_ancestral</option>
                    <option value="dpmpp_sde">dpmpp_sde</option>
                    <option value="dpmpp_sde_gpu">dpmpp_sde_gpu</option>
                    <option value="dpmpp_2m">dpmpp_2m</option>
                    <option value="dpmpp_2m_sde">dpmpp_2m_sde</option>
                    <option value="dpmpp_2m_sde_gpu">dpmpp_2m_sde_gpu</option>
                    <option value="dpmpp_3m_sde">dpmpp_3m_sde</option>
                    <option value="dpmpp_3m_sde_gpu">dpmpp_3m_sde_gpu</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="lms">lms</option>
                    <option value="lcm">lcm</option>
                    <option value="uni_pc">uni_pc</option>
                    <option value="uni_pc_bh2">uni_pc_bh2</option>
                  </optgroup>
                </select>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm uppercase font-bold text-white tracking-widest group-hover:text-[var(--accent)] transition-colors">高清生图模式 (HQ)</span>
                <input 
                  type="checkbox" 
                  checked={isHighQuality} 
                  onChange={(e) => setIsHighQuality(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                />
              </label>
              <div className="text-[10px] text-[var(--text-dim)] mt-1.5 font-mono uppercase">使用 Nano Banana 2 图像核心</div>
            </div>

            <div className="mt-3 p-2.5 bg-[#1a1c1f] border border-[var(--border)] rounded mb-4">
              <div className="text-sm uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-2 flex items-center gap-1.5 hover:text-white transition-colors cursor-help" title="用于 Gemini Pro 分离生图与提示词分析。如果遇到 429 报错，请在此处覆盖平台配置。">
                <Sparkles className="w-3 h-3" /> 自定义 API Key
              </div>
              <div className="relative group">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="Paste your Gemini API Key here..."
                  className="w-full bg-[#111] border border-[var(--border)] rounded px-2.5 py-1.5 text-sm text-white outline-none focus:border-[var(--accent)] font-mono transition-colors pr-8 placeholder:text-gray-600"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[var(--accent)] transition-colors p-0.5"
                >
                  {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
            
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing || !script.trim()}
            className="w-full py-3 bg-[var(--accent)] text-black rounded font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
          >
            {isAnalyzing ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              "开始智能分析"
            )}
          </button>
        </aside>

        {/* Content Area */}
        <div className="flex-1 bg-[var(--bg)] overflow-y-auto p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            {!results && !rawAnalysisText ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center opacity-40"
              >
                {isAnalyzing ? (
                  <div className="w-64 max-w-full">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-bold text-[var(--accent)] uppercase tracking-widest flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        AI 深度拆解中
                      </span>
                      <span className="text-xs font-mono text-[var(--text-dim)]">{analysisProgress}%</span>
                    </div>
                    <div className="h-1 bg-[#1a1c1f] rounded overflow-hidden">
                      <motion.div 
                        className="h-full bg-[var(--accent)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${analysisProgress}%` }}
                        transition={{ ease: "linear" }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-dim)] font-mono uppercase mt-3 tracking-wider">
                      {analysisProgress < 30 ? "正在提取角色与场景..." : analysisProgress < 60 ? "分析时间线与动作发生..." : analysisProgress < 85 ? "匹配影视级构图模式..." : "整合封包中..."}
                    </p>
                  </div>
                ) : (
                  <>
                    <LayoutGrid className="w-12 h-12 mb-4 text-[var(--text-dim)]" />
                    <p className="text-sm font-mono uppercase tracking-[0.3em]">等待内容输入处理...</p>
                  </>
                )}
              </motion.div>
            ) : rawAnalysisText && !results ? (
              <motion.div 
                key="rawText"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col h-full gap-4 max-w-5xl mx-auto"
              >
                <div className="bg-[#1a1c1f] border border-[var(--border)] rounded p-6 flex flex-col flex-1 shadow-xl">
                  <h3 className="text-sm font-bold text-[var(--accent)] uppercase tracking-widest flex items-center gap-2 mb-4">
                    <FileText className="w-4 h-4" /> 
                    大语言模型原始文本输出 
                    <span className="text-[10px] text-[var(--text-dim)] font-normal ml-2">模型未能输出纯净 JSON 格式，请检查或手动拆分</span>
                  </h3>
                  <textarea
                    className="flex-1 w-full bg-[#0a0a0a] border border-[var(--border)] rounded text-[11px] leading-relaxed text-white p-4 font-mono custom-scrollbar resize-none mb-6 outline-none focus:border-[var(--accent)] transition-colors"
                    value={rawAnalysisText}
                    onChange={(e) => setRawAnalysisText(e.target.value)}
                  />
                  <button
                    onClick={handleAutoSplit}
                    className="w-full py-3.5 bg-[var(--accent)] text-black rounded font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/10"
                  >
                    <ListTree className="w-4 h-4" /> 一键自动拆分成分镜列表展示
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                {activeTab === "analysis" && (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <SectionTitle>角色元数据</SectionTitle>
                        {results.characters.map((char, i) => (
                          <Card 
                            key={i} 
                            title={char.name}
                            headerRight={
                              <button 
                                onClick={() => generateMetaImage('character', char, i)}
                                disabled={generatingMetaImage === `character-${i}`}
                                className="text-[10px] bg-[var(--accent)] text-black px-2 py-0.5 rounded flex items-center gap-1 hover:brightness-110 disabled:opacity-50"
                              >
                                {generatingMetaImage === `character-${i}` ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImageIcon className="w-3 h-3"/>}
                                生图
                              </button>
                            }
                          >
                            <textarea
                              value={char.description}
                              onChange={(e) => updateCharacter(i, "description", e.target.value)}
                              className="w-full bg-[#111] border border-[var(--border)] rounded p-2 text-[10px] text-white outline-none focus:border-[var(--accent)] mb-3 h-16 resize-none"
                            />
                            <div className="grid gap-2">
                              <div>
                                <div className="text-[8px] uppercase font-bold text-[var(--text-dim)] mb-1">服装设定</div>
                                <input
                                  type="text"
                                  value={char.clothing}
                                  onChange={(e) => updateCharacter(i, "clothing", e.target.value)}
                                  className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1 text-[10px] text-white outline-none focus:border-[var(--accent)]"
                                />
                              </div>
                              <div>
                                <div className="text-[8px] uppercase font-bold text-[var(--text-dim)] mb-1">妆造设定</div>
                                <input
                                  type="text"
                                  value={char.makeup}
                                  onChange={(e) => updateCharacter(i, "makeup", e.target.value)}
                                  className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1 text-[10px] text-white outline-none focus:border-[var(--accent)]"
                                />
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <SectionTitle>场景环境扫描</SectionTitle>
                        {results.scenes.map((scene, i) => (
                          <Card 
                            key={i} 
                            title={scene.name} 
                            className="border-l-2 border-l-[var(--accent)]"
                            headerRight={
                              <button 
                                onClick={() => generateMetaImage('scene', scene, i)}
                                disabled={generatingMetaImage === `scene-${i}`}
                                className="text-[10px] bg-[var(--accent)] text-black px-2 py-0.5 rounded flex items-center gap-1 hover:brightness-110 disabled:opacity-50"
                              >
                                {generatingMetaImage === `scene-${i}` ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImageIcon className="w-3 h-3"/>}
                                生图
                              </button>
                            }
                          >
                            <div className="mb-2">
                              <span className="text-[var(--text-dim)] uppercase text-[9px] font-bold block mb-1">整体环境</span>
                              <input 
                                type="text"
                                value={scene.setting}
                                onChange={(e) => updateScene(i, "setting", e.target.value)}
                                className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1 text-[10px] text-white outline-none focus:border(--accent)"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[var(--border)]">
                              <div>
                                <div className="text-[8px] uppercase font-bold text-[var(--text-dim)]">光影氛围</div>
                                <input 
                                  type="text"
                                  value={scene.lighting}
                                  onChange={(e) => updateScene(i, "lighting", e.target.value)}
                                  className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1 text-[10px] text-white outline-none focus:border-[var(--accent)]"
                                />
                              </div>
                              <div>
                                <div className="text-[8px] uppercase font-bold text-[var(--text-dim)]">空间感</div>
                                <input 
                                  type="text"
                                  value={scene.atmosphere}
                                  onChange={(e) => updateScene(i, "atmosphere", e.target.value)}
                                  className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1 text-[10px] text-white outline-none focus:border-[var(--accent)]"
                                />
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <SectionTitle>道具清单 / 资产</SectionTitle>
                        <div className="grid grid-cols-1 gap-4">
                          {results.props.map((prop, i) => (
                            <div key={i} className="bg-[var(--surface)] border border-[var(--border)] p-3 rounded">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 flex-1">
                                  <input 
                                    type="text"
                                    value={prop.name}
                                    onChange={(e) => updateProp(i, "name", e.target.value)}
                                    className="bg-transparent border-none text-[10px] font-bold text-white uppercase outline-none focus:text-[var(--accent)] p-0 m-0 flex-1"
                                  />
                                  <Badge>道具</Badge>
                                </div>
                                <button 
                                  onClick={() => generateMetaImage('prop', prop, i)}
                                  disabled={generatingMetaImage === `prop-${i}`}
                                  className="text-[10px] bg-[var(--accent)] text-black px-2 py-0.5 rounded flex items-center gap-1 hover:brightness-110 disabled:opacity-50 ml-2"
                                >
                                  {generatingMetaImage === `prop-${i}` ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImageIcon className="w-3 h-3"/>}
                                  生图
                                </button>
                              </div>
                              <textarea
                                value={prop.description}
                                onChange={(e) => updateProp(i, "description", e.target.value)}
                                className="w-full bg-[#111] border border-[var(--border)] rounded p-2 text-[10px] text-[var(--text-dim)] outline-none focus:border-[var(--accent)] h-12 resize-none leading-tight"
                              />
                              <div className="mt-2 text-[8px] font-mono text-[var(--accent)] opacity-60 flex items-center gap-1">
                                <span className="flex-shrink-0">使用记录 ::</span>
                                <input 
                                  type="text"
                                  value={prop.usage}
                                  onChange={(e) => updateProp(i, "usage", e.target.value)}
                                  className="bg-transparent border-none text-[8px] font-mono text-[var(--accent)] outline-none flex-1 p-0 m-0"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                )}

                {activeTab === "storyboard" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <SectionTitle>分镜矩阵控制台</SectionTitle>
                        {results.storyboard.length > 9 && (
                          <div className="flex items-center gap-2 bg-[var(--surface)] p-1 rounded border border-[var(--border)]">
                            <button 
                              disabled={gridPage === 0}
                              onClick={() => setGridPage(p => Math.max(0, p - 1))}
                              className="p-1 hover:text-[var(--accent)] disabled:opacity-30"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-[10px] font-mono font-bold">批次 {gridPage + 1}</span>
                            <button 
                              disabled={(gridPage + 1) * 9 >= results.storyboard.length}
                              onClick={() => setGridPage(p => p + 1)}
                              className="p-1 hover:text-[var(--accent)] disabled:opacity-30"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={generateNineGrid}
                          disabled={isGridExporting || results.storyboard.length === 0}
                          className="text-[10px] border border-[var(--accent)] text-[var(--accent)] px-3 py-1.5 rounded font-bold uppercase tracking-widest hover:bg-[var(--accent)] hover:text-black transition-all disabled:opacity-50"
                        >
                          <LayoutGrid className="w-3 h-3 inline-block mr-2 -mt-0.5" />
                          生成当前批次的9宫格分镜图 (第 {gridPage + 1} 批)
                        </button>
                        <button 
                          onClick={generateAllFrameImages}
                          disabled={isGeneratingAll}
                          className="text-[10px] bg-white text-black px-3 py-1.5 rounded font-bold uppercase tracking-widest hover:bg-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingAll ? "处理中..." : "批量生成当前分镜"}
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {results.storyboard.slice(gridPage * 9, (gridPage * 9) + 9).map((frame, index) => (
                        <StoryboardFrameCard 
                          key={frame.frameNumber} 
                          frame={frame} 
                          imageUrl={frameImages[frame.frameNumber]}
                          onGenerateImage={handleFrameImageGenerated}
                          onPreview={() => setPreviewFrameIndex((gridPage * 9) + index)}
                          onUpdatePrompt={(newPrompt) => updateStoryboardFrame((gridPage * 9) + index, "visualDescription", newPrompt)}
                          isHighQuality={isHighQuality}
                          globalStyle={customStyle ? `${globalStyle}, ${customStyle}` : globalStyle}
                          projectContext={getProjectContext()}
                          aspectRatio={aspectRatio}
                          engineConfigs={{
                            engine: selectedEngine,
                            comfyUrl,
                            comfyNodeId,
                            comfyWorkflow
                          }}
                          customApiKey={customApiKey}
                        />
                      ))}
                    </div>

                    {/* Hidden canvas for grid export */}
                    <canvas ref={gridCanvasRef} className="hidden" />

                    {gridImageUrls[gridPage] && gridImageUrls[gridPage].length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 pt-8 border-t border-[var(--border)] pb-8"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <SectionTitle>第 {gridPage + 1} 批次 九宫格合成图</SectionTitle>
                        </div>
                        <div className="flex flex-col gap-8">
                          {gridImageUrls[gridPage].map((url, index) => {
                            const isLatest = index === 0;
                            return (
                              <div key={index} className={`flex flex-col gap-2 ${!isLatest ? 'w-1/2 opacity-60 hover:opacity-100 hover:w-full transition-all duration-300 mx-auto' : 'w-full'}`}>
                                <div className="flex justify-between items-center px-2">
                                  <span className="text-[10px] text-[var(--accent)] uppercase tracking-wider font-bold">
                                    # {gridImageUrls[gridPage].length - index} {isLatest ? "(最新)" : "(历史版本)"}
                                  </span>
                                  <a 
                                    href={url} 
                                    download={`storyboard_grid_page_${gridPage + 1}_v${gridImageUrls[gridPage].length - index}.jpg`}
                                    className="text-[10px] bg-[var(--accent)] text-black px-4 py-1.5 rounded font-bold uppercase tracking-widest hover:brightness-110 transition-colors"
                                  >
                                    下载原图
                                  </a>
                                </div>
                                <div className="bg-[#0A0B0D] border border-[var(--border)] rounded-lg p-2 flex justify-center shadow-2xl">
                                  <img 
                                    src={url} 
                                    alt={`9-Grid Batch ${gridPage + 1} v${gridImageUrls[gridPage].length - index}`} 
                                    className="w-full max-w-5xl object-contain rounded"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Image Preview Modal */}
      <ImageModal 
        index={previewFrameIndex}
        storyboard={results?.storyboard || []}
        images={frameImages}
        onClose={() => setPreviewFrameIndex(null)}
        onNavigate={(newIndex) => setPreviewFrameIndex(newIndex)}
        onUpdate={updateStoryboardFrame}
      />
      
      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <LoginModal onClose={() => setShowLoginModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ImageModal({ 
  index, 
  storyboard, 
  images, 
  onClose, 
  onNavigate,
  onUpdate
}: { 
  index: number | null; 
  storyboard: StoryboardFrame[]; 
  images: Record<number, string>;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onUpdate: (index: number, field: keyof StoryboardFrame, value: string | number) => void;
}) {
  if (index === null) return null;
  const frame = storyboard[index];
  const imageUrl = images[frame.frameNumber];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/95 pointer-events-auto"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative max-w-6xl w-full aspect-video bg-[#0D0E10] border border-[var(--border)] rounded-lg overflow-hidden shadow-2xl z-10 pointer-events-auto flex flex-col"
      >
        <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={onClose}
            className="p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 relative group flex items-center justify-center">
          {imageUrl && (
            <img 
              src={imageUrl} 
              alt={`Frame ${frame.frameNumber}`} 
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}

          <button 
            disabled={index === 0}
            onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
            className="absolute left-4 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all disabled:opacity-0"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <button 
            disabled={index === storyboard.length - 1}
            onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
            className="absolute right-4 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all disabled:opacity-0"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>

        <div className="h-24 bg-[var(--surface)] border-t border-[var(--border)] p-4 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[var(--accent)] text-black px-2 py-0.5 rounded text-[10px] font-bold font-mono">FRAME {frame.frameNumber}</span>
            <input 
              type="text"
              value={frame.composition}
              onChange={(e) => onUpdate(index, "composition", e.target.value)}
              className="bg-transparent border-none text-[var(--text-dim)] text-[10px] font-mono tracking-tighter uppercase outline-none focus:text-white p-0 m-0"
            />
          </div>
          <textarea 
            value={frame.visualDescription}
            onChange={(e) => onUpdate(index, "visualDescription", e.target.value)}
            className="w-full bg-transparent border-none text-xs text-[var(--text-main)] italic opacity-80 leading-snug outline-none focus:opacity-100 resize-none h-12 p-0 m-0"
          />
        </div>
      </motion.div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
        active 
          ? "bg-white text-gray-900 shadow-sm" 
          : "text-gray-500 hover:text-gray-800"
      }`}
    >
      {label}
    </button>
  );
}
