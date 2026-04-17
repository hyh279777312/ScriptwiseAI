import React, { useState, useRef } from "react";
import { 
  analyzeScript, 
  AnalysisResult, 
  generateFrameImage,
  generateGridImage,
  Character,
  Scene,
  Prop,
  StoryboardFrame
} from "./services/gemini";
import { 
  Card, 
  Badge, 
  SectionTitle 
} from "./components/UI";
import { extractTextFromFile } from "./lib/extract";
import { StoryboardFrameCard } from "./components/StoryboardFrameCard";
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
  ListTree
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [script, setScript] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [frameImages, setFrameImages] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"analysis" | "storyboard">("analysis");

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
  
  // Analysis Engine configurations
  const [analysisEngine, setAnalysisEngine] = useState<"gemini" | "ollama">("gemini");
  const [analysisOllamaUrl, setAnalysisOllamaUrl] = useState("http://127.0.0.1:11434");
  const [analysisOllamaModel, setAnalysisOllamaModel] = useState("qwen:latest");

  // Image Generation Engine configurations
  const [selectedEngine, setSelectedEngine] = useState<"gemini" | "comfyui">("gemini");
  const [comfyUrl, setComfyUrl] = useState("http://127.0.0.1:8188");
  const [comfyNodeId, setComfyNodeId] = useState("6");
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

  const styleOptions = [
    { label: "电影感", value: "电影感镜头, 8k, 高度细节, 电影光效" },
    { label: "动漫", value: "动漫风格, 色彩鲜艳, 表现力强" },
    { label: "黑色电影", value: "黑色电影风格, 黑白, 戏剧性阴影" },
    { label: "素描", value: "铅笔素描, 手绘概念图" },
    { label: "赛博朋克", value: "赛博朋克风格, 霓虹灯, 高科技感" },
    { label: "油画", value: "油画风格, 质感笔触" },
  ];

  const aspectRatios = [
    { label: "16:9", value: "16:9" },
    { label: "4:3", value: "4:3" },
    { label: "9:16", value: "9:16" },
    { label: "21:9", value: "21:9" },
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
        setReferenceImages(prev => [...prev, reader.result as string]);
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
        res = await analyzeScript(script, referenceImages);
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
    if (!results) return "";
    return `
      CHARACTERS: ${results.characters.map(c => `${c.name}(${c.description}, Outfit:${c.clothing})`).join("; ")}
      EQUIPMENT/PROPS: ${results.props.map(p => `${p.name}(${p.description})`).join("; ")}
      SCENES: ${results.scenes.map(s => `${s.name}(${s.setting}, ${s.atmosphere})`).join("; ")}
    `.trim();
  };

  const generateAllFrameImages = async () => {
    if (!results || isGeneratingAll) return;
    setIsGeneratingAll(true);
    setGenStatus("批量处理中...");
    
    const frames = results.storyboard;
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
            url = await generateComfyUIFrame(
              comfyUrl,
              comfyWorkflow,
              comfyNodeId,
              frame.visualDescription,
              customStyle || globalStyle
            );
          } else {
            url = await generateFrameImage(
              frame.visualDescription, 
              isHighQuality, 
              customStyle || globalStyle,
              getProjectContext(),
              aspectRatio
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
      const url = await generateGridImage(frameData, isHighQuality, combinedStyle, getProjectContext(), aspectRatio);

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
            ScriptWise AI <span className="font-light opacity-60">/ Analyzer</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-tight">
            PRJ_ID: 2024_VISION | VER: 3.1.0-STABLE
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
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[300px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col p-4 gap-6 overflow-y-auto custom-scrollbar flex-shrink-0">
          <div>
            <div className="text-[10px] uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-2 flex justify-between">
              <span>输入剧本/梗概</span>
              {isExtractingDoc && <span className="opacity-70 animate-pulse text-[8px] mt-0.5">解析中...</span>}
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
                className="w-full h-40 bg-[#111] border border-[var(--border)] rounded p-3 text-xs text-white outline-none focus:border-[var(--accent)] transition-colors resize-none font-sans leading-relaxed disabled:opacity-50"
              />
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleImageDrop}
          >
            <div className="text-[10px] uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-2">视觉参考图 <span className="text-[8px] opacity-40 font-normal">(支持拖拽)</span></div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {referenceImages.map((img, i) => (
                <div key={i} className="relative aspect-square rounded border border-[var(--border)] overflow-hidden group">
                  <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => removeImage(i)}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
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
            <div className="text-[10px] uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-3">生成艺术风格</div>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {styleOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setGlobalStyle(opt.value);
                  }}
                  className={`text-[9px] py-1 border rounded transition-all font-mono uppercase ${
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
              <div className="text-[8px] uppercase font-bold text-white opacity-40">自定义风格关键词</div>
              <input
                type="text"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="例如: 赛博朋克, 高对比度..."
                className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 text-[10px] text-white outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="bg-[#1a1c1f] border border-[var(--border)] p-3 rounded">
            <div className="text-[10px] uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-3">画面长宽比</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {aspectRatios.map((ar) => (
                <button
                  key={ar.label}
                  onClick={() => setAspectRatio(ar.value)}
                  className={`text-[9px] py-1 px-2 border rounded transition-all font-mono uppercase flex-1 whitespace-nowrap ${
                    aspectRatio === ar.value
                      ? "bg-[var(--accent)] text-black border-[var(--accent)] font-bold"
                      : "bg-[#111] text-[var(--text-dim)] border-[var(--border)] hover:border-[var(--text-dim)]"
                  }`}
                >
                  {ar.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#1a1c1f] border border-[var(--border)] p-3 rounded mt-4">
            <div className="text-[10px] uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-3">工作流引擎配置</div>
            
            {/* Analysis Engine Config */}
            <div className="mb-4">
              <div className="text-[9px] text-[var(--text-dim)] uppercase font-mono tracking-widest mb-1.5 flex items-center gap-1">
                <Send className="w-2.5 h-2.5" />
                1. 智能分析引擎 (分镜转换)
              </div>
              <div className="flex gap-2 mb-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="analysis_engine" value="gemini" checked={analysisEngine === "gemini"} onChange={() => setAnalysisEngine("gemini")} className="accent-[var(--accent)]" />
                  <span className="text-[10px] text-white">Gemini 2.5 Pro</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="analysis_engine" value="ollama" checked={analysisEngine === "ollama"} onChange={() => setAnalysisEngine("ollama")} className="accent-[var(--accent)]" />
                  <span className="text-[10px] text-[var(--accent)]">本地 Ollama (大模型)</span>
                </label>
              </div>
              {analysisEngine === "ollama" && (
                <div className="space-y-2 p-2 bg-[#2a2c31] border border-[var(--border)] rounded mb-3">
                  <div>
                    <label className="text-[8px] uppercase font-bold text-white opacity-60">API 地址</label>
                    <input type="text" value={analysisOllamaUrl} onChange={(e) => setAnalysisOllamaUrl(e.target.value)} className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1 mt-1 text-[9px] text-white outline-none focus:border-[var(--accent)]" />
                  </div>
                  <div>
                    <label className="text-[8px] uppercase font-bold text-white opacity-60">模型名称 (Model)</label>
                    <input type="text" value={analysisOllamaModel} onChange={(e) => setAnalysisOllamaModel(e.target.value)} className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1 mt-1 text-[9px] text-white outline-none focus:border-[var(--accent)]" />
                  </div>
                </div>
              )}
            </div>

            {/* Image Gen Engine Config */}
            <div>
              <div className="text-[9px] text-[var(--text-dim)] uppercase font-mono tracking-widest mb-1.5 flex items-center gap-1">
                <ImageIcon className="w-2.5 h-2.5" />
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
                  <span className="text-[10px] text-white">Google Gemini (推荐)</span>
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
                  <span className="text-[10px] text-[var(--accent)]">本地 ComfyUI</span>
                </label>
              </div>

              {selectedEngine === "comfyui" && (
                <div className="space-y-2 mt-3 p-2 bg-[#2a2c31] border border-[var(--border)] rounded">
                  <div>
                    <label className="text-[8px] uppercase font-bold text-white opacity-60">API 地址 (需开启 --listen)</label>
                    <input
                      type="text"
                      value={comfyUrl}
                      onChange={(e) => setComfyUrl(e.target.value)}
                      className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1 mt-1 text-[9px] text-white outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] uppercase font-bold text-white opacity-60">提示词 Node ID (CLIPTextEncode)</label>
                    <input
                      type="text"
                      value={comfyNodeId}
                      onChange={(e) => setComfyNodeId(e.target.value)}
                      className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1 mt-1 text-[9px] text-white outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] uppercase font-bold text-white opacity-60">完整 Workflow (API Format)</label>
                    <textarea
                      value={comfyWorkflow}
                      onChange={(e) => setComfyWorkflow(e.target.value)}
                      className="w-full h-20 bg-[#111] border border-[var(--border)] rounded px-2 py-1 mt-1 text-[8px] text-white outline-none focus:border-[var(--accent)] font-mono resize-none custom-scrollbar"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="text-[9px] uppercase font-bold text-white tracking-widest mb-2 mt-4 pt-4 border-t border-[var(--border)]">渲染参数</div>
            <div className="space-y-1.5 font-mono text-[9px] text-[var(--text-dim)]">
              <div className="flex justify-between"><span>布局模式</span><span className="text-white">智能自动</span></div>
              <div className="flex justify-between"><span>提示词权重</span><span className="text-white">0.85</span></div>
              <div className="flex justify-between"><span>采样算法</span><span className="text-white">Cinematic</span></div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-[9px] uppercase font-bold text-white tracking-widest group-hover:text-[var(--accent)] transition-colors">高清生图模式 (HQ)</span>
                <input 
                  type="checkbox" 
                  checked={isHighQuality} 
                  onChange={(e) => setIsHighQuality(e.target.checked)}
                  className="w-3 h-3 accent-[var(--accent)] cursor-pointer"
                />
              </label>
              <div className="text-[7px] text-[var(--text-dim)] mt-1 font-mono uppercase">使用 Nano Banana 2 图像核心</div>
            </div>

            <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded mb-4">
              <div className="text-[8px] font-bold text-blue-400 uppercase mb-1 flex items-center gap-1">
                <Sparkles className="w-2 h-2" /> 配额提示
              </div>
              <p className="text-[7px] text-blue-300/70 font-mono leading-tight">
                如果遇到 429 错误，请在页面右上角选择您的个人 API Key (Member Quota) 以关联 Gemini Pro 会员权益。
              </p>
            </div>
          </div>
            
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing || !script.trim()}
            className="w-full py-2.5 bg-[var(--accent)] text-black rounded font-bold text-xs uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
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
                <LayoutGrid className="w-12 h-12 mb-4 text-[var(--text-dim)]" />
                <p className="text-sm font-mono uppercase tracking-[0.3em]">等待内容输入处理...</p>
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
                          <Card key={i} title={char.name}>
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
                          <Card key={i} title={scene.name} className="border-l-2 border-l-[var(--accent)]">
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
                                <input 
                                  type="text"
                                  value={prop.name}
                                  onChange={(e) => updateProp(i, "name", e.target.value)}
                                  className="bg-transparent border-none text-[10px] font-bold text-white uppercase outline-none focus:text-[var(--accent)] p-0 m-0"
                                />
                                <Badge>道具</Badge>
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

      {/* Status Bar */}
      <footer className="h-[24px] bg-[var(--accent)] text-black font-mono text-[10px] font-bold flex items-center px-4 uppercase tracking-tighter justify-between">
        <div>
          系统运行中 // GPU负载: {isGeneratingAll ? "88%" : "12%"} // 渲染队列: {Object.keys(frameImages).length}/{results?.storyboard.length || "0"} // 准备导出数据
        </div>
        {genStatus && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{genStatus}</span>
          </div>
        )}
      </footer>

      {/* Image Preview Modal */}
      <ImageModal 
        index={previewFrameIndex}
        storyboard={results?.storyboard || []}
        images={frameImages}
        onClose={() => setPreviewFrameIndex(null)}
        onNavigate={(newIndex) => setPreviewFrameIndex(newIndex)}
        onUpdate={updateStoryboardFrame}
      />
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
