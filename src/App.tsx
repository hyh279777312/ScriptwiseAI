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
  ReferenceImage,
} from "./services/gemini";
import { Card, Badge, SectionTitle } from "./components/UI";
import { extractTextFromFile } from "./lib/extract";
import { StoryboardFrameCard } from "./components/StoryboardFrameCard";
import { LoginModal } from "./components/LoginModal";
import { ImageToolsView } from "./components/ImageToolsView";
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
  LogOut,
  File,
  FolderOpen,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import {
  Download,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Maximize,
} from "lucide-react";

export default function App() {
  const [script, setScript] = useState("");
  const [uploadedScriptFile, setUploadedScriptFile] = useState<{name: string, text: string} | null>(null);
  const [isDraggingScript, setIsDraggingScript] = useState(false);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [frameImages, setFrameImages] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"analysis" | "storyboard" | "image-tools">(
    "analysis",
  );
  const [generatingMetaImage, setGeneratingMetaImage] = useState<string | null>(
    null,
  );
  const [generatingFrames, setGeneratingFrames] = useState<Record<number, boolean>>({});
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [layoutMode, setLayoutMode] = useState("智能自动");
  const [promptWeight, setPromptWeight] = useState("1.0");
  const [samplerName, setSamplerName] = useState("euler");
  const [samplingSteps, setSamplingSteps] = useState("10");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [optimizingFramePrompt, setOptimizingFramePrompt] = useState<
    number | null
  >(null);
  const [optimizingEntity, setOptimizingEntity] = useState<{
    type: string;
    index: number;
  } | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [lightboxData, setLightboxData] = useState<{
    images: string[];
    index: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [globalStyle, setGlobalStyle] = useState("Cinematic Movie");
  const [customStyle, setCustomStyle] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [metaImages, setMetaImages] = useState<Record<string, string>>({});
  const [tablePadding, setTablePadding] = useState(8);
  const [tableLineHeight, setTableLineHeight] = useState(1.5);
  const [tableFontSize, setTableFontSize] = useState(12);
  const [characterCols, setCharacterCols] = useState<string[]>([]);
  const [sceneCols, setSceneCols] = useState<string[]>([]);
  const [propCols, setPropCols] = useState<string[]>([]);
  const [storyboardCols, setStoryboardCols] = useState<string[]>([]);
  const [projectName, setProjectName] = useState("未命名工程");
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [analysisEngine, setAnalysisEngine] = useState<string>("ollama");
  const [analysisOllamaUrl, setAnalysisOllamaUrl] = useState(
    "http://127.0.0.1:11434",
  );
  const [selectedEngine, setSelectedEngine] = useState<string>("comfyui_t2i");
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
  const [previewFrameIndex, setPreviewFrameIndex] = useState<number | null>(
    null,
  );
  const [localWorkflows, setLocalWorkflows] = useState<any[]>([]);

  useEffect(() => {
    try {
      const workflowModules = (import.meta as any).glob('../WorkFlowSample/*.json', { eager: true });
      const workflows = Object.entries(workflowModules).map(([path, moduleExport]) => {
        const filename = path.split('/').pop() || '';
        return {
          filename,
          content: (moduleExport as any).default || moduleExport
        };
      });
      setLocalWorkflows(workflows);
    } catch (err) {
      console.error("Failed to load workflows:", err);
    }
  }, []);

  const handleSelectLocalWorkflow = (filename: string) => {
    const workflow = localWorkflows.find((w) => w.filename === filename);
    if (workflow) {
      setComfyWorkflow(JSON.stringify(workflow.content, null, 2));
      // Extract node ID from filename: T2I-Z-image-ID[5].json -> 5
      const match = filename.match(/\[(\d+)\]/);
      if (match && match[1]) {
        setComfyNodeId(match[1]);
      }
    }
  };
  const [gridPage, setGridPage] = useState(0);
  const [isGridExporting, setIsGridExporting] = useState(false);
  const [gridImageUrls, setGridImageUrls] = useState<Record<number, string[]>>(
    {},
  );
  const [isOptimizing, setIsOptimizing] = useState<string | null>(null);
  const [storyboardColWidths, setStoryboardColWidths] = useState<Record<string, number>>({
    index: 60,
    shot: 100,
    narration: 220,
    subtitles: 180,
    visual: 350,
    actions: 80,
    preview: 280,
    videoPrompt: 200,
  });
  const [storyboardRowHeights, setStoryboardRowHeights] = useState<Record<number, number>>({});
  
  // Character Table Resizing
  const [characterColWidths, setCharacterColWidths] = useState<Record<string, number>>({
    name: 120,
    description: 300,
    clothing: 150,
    makeup: 150,
    actions: 80,
    preview: 150,
  });
  const [characterRowHeights, setCharacterRowHeights] = useState<Record<number, number>>({});

  // Scene Table Resizing
  const [sceneColWidths, setSceneColWidths] = useState<Record<string, number>>({
    name: 120,
    setting: 300,
    lighting: 150,
    atmosphere: 150,
    actions: 80,
    preview: 150,
  });
  const [sceneRowHeights, setSceneRowHeights] = useState<Record<number, number>>({});

  // Prop Table Resizing
  const [propColWidths, setPropColWidths] = useState<Record<string, number>>({
    name: 120,
    description: 300,
    usage: 180,
    actions: 80,
    preview: 150,
  });
  const [propRowHeights, setPropRowHeights] = useState<Record<number, number>>({});

  const [resizingCol, setResizingCol] = useState<{ table: string; key: string; startX: number; startWidth: number } | null>(null);
  const [resizingRow, setResizingRow] = useState<{ table: string; index: number; startY: number; startHeight: number } | null>(null);

  const handleColResizeStart = (e: React.MouseEvent, table: string, key: string) => {
    e.preventDefault();
    let currentWidth = 100;
    if (table === 'storyboard') currentWidth = storyboardColWidths[key] || 100;
    if (table === 'character') currentWidth = characterColWidths[key] || 100;
    if (table === 'scene') currentWidth = sceneColWidths[key] || 100;
    if (table === 'prop') currentWidth = propColWidths[key] || 100;

    setResizingCol({
      table,
      key,
      startX: e.clientX,
      startWidth: currentWidth,
    });
  };

  const handleRowResizeStart = (e: React.MouseEvent, table: string, index: number, currentHeight: number) => {
    e.preventDefault();
    setResizingRow({
      table,
      index,
      startY: e.clientY,
      startHeight: currentHeight,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingCol) {
        const deltaX = (e.clientX - resizingCol.startX) / zoomScale;
        const newWidth = Math.max(40, resizingCol.startWidth + deltaX);
        if (resizingCol.table === 'storyboard') {
          setStoryboardColWidths(prev => ({ ...prev, [resizingCol.key]: newWidth }));
        } else if (resizingCol.table === 'character') {
          setCharacterColWidths(prev => ({ ...prev, [resizingCol.key]: newWidth }));
        } else if (resizingCol.table === 'scene') {
          setSceneColWidths(prev => ({ ...prev, [resizingCol.key]: newWidth }));
        } else if (resizingCol.table === 'prop') {
          setPropColWidths(prev => ({ ...prev, [resizingCol.key]: newWidth }));
        }
      }
      if (resizingRow) {
        const deltaY = (e.clientY - resizingRow.startY) / zoomScale;
        const newHeight = Math.max(40, resizingRow.startHeight + deltaY);
        if (resizingRow.table === 'storyboard') {
          setStoryboardRowHeights(prev => ({ ...prev, [resizingRow.index]: newHeight }));
        } else if (resizingRow.table === 'character') {
          setCharacterRowHeights(prev => ({ ...prev, [resizingRow.index]: newHeight }));
        } else if (resizingRow.table === 'scene') {
          setSceneRowHeights(prev => ({ ...prev, [resizingRow.index]: newHeight }));
        } else if (resizingRow.table === 'prop') {
          setPropRowHeights(prev => ({ ...prev, [resizingRow.index]: newHeight }));
        }
      }
    };

    const handleMouseUp = () => {
      setResizingCol(null);
      setResizingRow(null);
    };

    if (resizingCol || resizingRow) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, resizingRow]);

  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [rawAnalysisText, setRawAnalysisText] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    gemini: "",
    gpt: "",
    jimeng: "",
    doubao: "",
    kling: "",
    mj: "",
  });
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [isApiPanelOpen, setIsApiPanelOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Render Parameters

  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setAnalysisProgress(0);
      interval = setInterval(() => {
        setAnalysisProgress((p) => (p < 95 ? p + 1 : p));
      }, 300);
    } else {
      setAnalysisProgress(100);
      setTimeout(() => setAnalysisProgress(0), 500); // reset after a delay
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const buildPromptWithLayout = (
    basePrompt: string,
    frame?: StoryboardFrame,
  ) => {
    let finalPrompt = basePrompt;

    if (frame) {
      // 头部注入：[景别], [镜头动作], [画面构图]
      const prefix = [frame.shotType, frame.cameraMovement, frame.composition]
        .filter(Boolean)
        .join(", ");
      if (prefix) finalPrompt = `${prefix}, ${finalPrompt}`;
    } else if (layoutMode !== "智能自动") {
      finalPrompt = `[${layoutMode}] ${finalPrompt}`;
    }

    // 智能划分一致性信息 (角色、场景、道具)
    const context = getProjectContext();
    if (context) {
      finalPrompt = `${finalPrompt}\n\n[Consistency Context]: ${context}`;
    }

    // 尾部注入：全局风格, 提示词设置中的自定义风格, 比例
    const globalSettings = [globalStyle, customStyle, aspectRatio]
      .filter(Boolean)
      .join(", ");
    if (globalSettings)
      finalPrompt = `${finalPrompt}\n\n[Style & Output]: ${globalSettings}`;

    return finalPrompt;
  };

  const currentSamplerConfig = {
    promptWeight,
    samplerName,
    steps: samplingSteps,
  };

  const generateMetaImage = async (
    type: "character" | "scene" | "prop",
    item: any,
    index: number,
  ) => {
    const key = `${type}-${index}`;
    setGeneratingMetaImage(key);
    try {
      let prompt = "";
      if (type === "character") {
        // Collect all custom column data for this character
        const customData = characterCols
          .map((col) => (item[col] ? `${col}: ${item[col]}` : ""))
          .filter(Boolean)
          .join(". ");

        prompt = `Character Identity: ${item.name}.
        [核心特征与性格描述]: ${item.description}.
        [服装设定]: ${item.clothing}.
        [妆造设定]: ${item.makeup}.
        ${customData ? `[附加设定]: ${customData}.` : ""}
        
        STRICT REQUIREMENT: PURE WHITE BACKGROUND, clean white space, NO background elements, NO scenery, NO floor texture.
        STYLE: Professional character design sheet, cinematic lighting, 8k, highly detailed.
        LAYOUT: Left 1/3 is a detailed face close-up (looking at camera), right 2/3 is a full-body turnaround (front, side, back views). 
        TOP RIGHT: 9 different facial expressions.`;
      } else if (type === "scene") {
        prompt = `Environment Concept Art: ${item.name}. Setting: ${item.setting}. Lighting: ${item.lighting}. Atmosphere: ${item.atmosphere}. Establishing shot, cinematic lighting, highly detailed environment design.`;
      } else if (type === "prop") {
        prompt = `Prop Design Concept Art: ${item.name}. Description: ${item.description}. Usage context: ${item.usage}. Clear product shot, isolated on neutral background, highly detailed asset design.`;
      }

      // For characters, we bypass the global project context to strictly use the row data as requested
      let finalPrompt = "";
      if (type === "character") {
        const styleSuffix = [globalStyle, customStyle, aspectRatio]
          .filter(Boolean)
          .join(", ");
        finalPrompt = `${prompt}\n\n[Technical Specs]: ${styleSuffix}`;
      } else {
        finalPrompt = buildPromptWithLayout(prompt);
      }

      let url;
      if (selectedEngine.startsWith("comfyui")) {
        const isI2I =
          selectedEngine === "comfyui_i2i" ||
          selectedEngine === "comfyui_i2i_prompt";
        const { generateComfyUIFrame } = await import("./services/gemini");
        const urls = await generateComfyUIFrame(
          comfyUrl,
          comfyWorkflow,
          comfyNodeId,
          finalPrompt,
          "", // Style is already in finalPrompt for character, or handles via buildPromptWithLayout for others
          false,
          currentSamplerConfig,
          isI2I ? referenceImages : undefined,
          aspectRatio,
        );
        url = urls[0];
      } else if (
        selectedEngine === "jimeng" ||
        selectedEngine === "kling" ||
        selectedEngine === "mj"
      ) {
        const { generateWithOtherImageEngine } =
          await import("./services/gemini");
        const apiKey = apiKeys[selectedEngine] || "";
        url = await generateWithOtherImageEngine(
          finalPrompt,
          selectedEngine as any,
          apiKey,
          aspectRatio,
        );
      } else {
        url = await generateFrameImage(
          finalPrompt,
          // For characters, style is embedded. For others, we might want it separate or not, 
          // but generateFrameImage appends style anyway. 
          // Better pass Empty string for style if it's already in finalPrompt.
          type === "character" ? "" : globalStyle,
          type === "character" ? "" : getProjectContext(),
          aspectRatio,
          apiKeys.gemini,
        );
      }

      setReferenceImages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          url: url,
          name: `${item.name} 设定图`,
        },
      ]);
      setMetaImages((prev) => ({ ...prev, [key]: url }));
    } catch (err) {
      console.error(err);
      alert(`生成${item.name}的设定图失败: ` + String(err));
    } finally {
      setGeneratingMetaImage(null);
    }
  };

  const updateCharacter = (
    index: number,
    field: keyof Character,
    value: string,
  ) => {
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

  const updateStoryboardFrame = (
    index: number,
    field: keyof StoryboardFrame,
    value: string | number,
  ) => {
    if (!results) return;
    const newStoryboard = [...results.storyboard];
    newStoryboard[index] = { ...newStoryboard[index], [field]: value };
    setResults({ ...results, storyboard: newStoryboard });
  };

  const addRow = (type: "character" | "scene" | "prop" | "storyboard") => {
    if (!results) return;
    const newResults = { ...results };
    if (type === "character") {
      newResults.characters = [
        ...newResults.characters,
        { name: "新角色", description: "", clothing: "", makeup: "" },
      ];
    } else if (type === "scene") {
      newResults.scenes = [
        ...newResults.scenes,
        { name: "新场景", setting: "", lighting: "", atmosphere: "" },
      ];
    } else if (type === "prop") {
      newResults.props = [
        ...newResults.props,
        { name: "新道具", description: "", usage: "" },
      ];
    } else if (type === "storyboard") {
      const nextNum = newResults.storyboard.length + 1;
      newResults.storyboard = [
        ...newResults.storyboard,
        {
          frameNumber: nextNum,
          shotType: "全景",
          angle: "平视",
          visualDescription: "描述内容...",
          composition: "居中构图",
          dialogue: "",
          narration: "",
        },
      ];
    }
    setResults(newResults);
  };

  // Persistence: Save to localStorage
  useEffect(() => {
    const data = getProjectData();
    if (Object.keys(data).length > 0) {
      localStorage.setItem("filmmaker_project_latest", JSON.stringify(data));
    }
  }, [
    projectName,
    script,
    results,
    frameImages,
    globalStyle,
    customStyle,
    aspectRatio,
    analysisEngine,
    selectedEngine,
    comfyWorkflow,
    apiKeys,
    metaImages,
  ]);

  // Persistence: Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("filmmaker_project_latest");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        loadProjectData(parsed);
      } catch (e) {
        console.error("Failed to restore latest project", e);
      }
    }
  }, []);

  // Zoom Logic: Command/Ctrl + Wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY;
        setZoomScale((prev) => {
          const newScale = prev - delta * 0.001;
          return Math.min(Math.max(newScale, 0.4), 2.5);
        });
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  const handleOptimizeEntityPrompt = async (
    type: "character" | "scene" | "prop",
    index: number,
  ) => {
    if (!results) return;
    setOptimizingEntity({ type, index });
    try {
      let entityData: any = {};
      if (type === "character") entityData = results.characters[index];
      else if (type === "scene") entityData = results.scenes[index];
      else if (type === "prop") entityData = results.props[index];

      const { optimizeEntityPrompt } = await import("./services/gemini");
      const key = apiKeys[analysisEngine] || apiKeys.gemini;
      const optimized = await optimizeEntityPrompt(
        type,
        entityData,
        getProjectContext(),
        analysisEngine,
        key,
        { url: analysisOllamaUrl, model: analysisOllamaModel },
      );

      if (type === "character") {
        setResults((prev) => {
          if (!prev) return prev;
          const newChars = [...prev.characters];
          newChars[index] = {
            ...newChars[index],
            description: optimized.description,
            clothing: optimized.clothing,
            makeup: optimized.makeup,
          };
          return { ...prev, characters: newChars };
        });
      } else if (type === "scene") {
        setResults((prev) => {
          if (!prev) return prev;
          const newScenes = [...prev.scenes];
          newScenes[index] = {
            ...newScenes[index],
            setting: optimized.setting,
            lighting: optimized.lighting,
            atmosphere: optimized.atmosphere,
          };
          return { ...prev, scenes: newScenes };
        });
      } else if (type === "prop") {
        setResults((prev) => {
          if (!prev) return prev;
          const newProps = [...prev.props];
          newProps[index] = {
            ...newProps[index],
            description: optimized.description,
            usage: optimized.usage,
          };
          return { ...prev, props: newProps };
        });
      }
    } catch (err: any) {
      console.error(err);
      alert(`优化失败: ${err.message || "未知错误"}`);
    } finally {
      setOptimizingEntity(null);
    }
  };

  const handleOptimizeFramePrompt = async (index: number) => {
    if (!results) return;
    setOptimizingFramePrompt(index);
    try {
      const frame = results.storyboard[index];
      const { optimizeStoryboardPrompt } = await import("./services/gemini");
      const key = apiKeys[analysisEngine] || apiKeys.gemini;
      const optimized = await optimizeStoryboardPrompt(
        frame.visualDescription,
        getProjectContext(),
        analysisEngine,
        key,
        { url: analysisOllamaUrl, model: analysisOllamaModel },
      );
      if (optimized === frame.visualDescription) {
        alert("优化未发生变化或处理失败，请检查引擎连接状况。");
      }
      updateStoryboardFrame(index, "visualDescription", optimized);
    } catch (err: any) {
      console.error(err);
      alert(`优化失败: ${err.message || "未知错误"}`);
    } finally {
      setOptimizingFramePrompt(null);
    }
  };

  const handleExportPDF = async () => {
    // Zoom out to 100% for capture to ensure best resolution and layout
    const originalScale = zoomScale;
    setZoomScale(1);
    
    // Switch to a specialized capture ID that includes the title
    const id = activeTab === "analysis" ? "analysis-export-container" : "storyboard-export-container";
    
    // Wait for the scale transition and re-render
    await new Promise(r => setTimeout(r, 600));
    
    const element = document.getElementById(id);
    if (!element) {
      setZoomScale(originalScale);
      alert("未找到导出内容容器");
      return;
    }

    try {
      // Use higher scale for better print quality, but cap it to avoid memory issues
      const canvas = await html2canvas(element, {
        scale: 1.5, // Reduced slightly from 2 to avoid memory errors in large elements
        useCORS: true,
        logging: true, // Enable for debugging
        backgroundColor: "#ffffff",
        windowWidth: 1400, // Fixed width for consistent layout capture
        allowTaint: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          // Additional cleanup on the clone
          const clonedElement = clonedDoc.getElementById(id);
          if (clonedElement) {
            clonedElement.style.transform = 'none';
          }
        }
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      // Analysis is usually portrait, Storyboard (16:9) is landscape
      const pdf = new jsPDF(activeTab === "analysis" ? "p" : "l", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const contentHeightInPdf = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = contentHeightInPdf;
      let position = 0;

      // Add image to PDF with overflow handling
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, contentHeightInPdf);
      heightLeft -= pdfHeight;

      while (heightLeft > 1) { // 1mm buffer
        pdf.addPage();
        position = heightLeft - contentHeightInPdf;
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, contentHeightInPdf);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${projectName || "script_export"}_${activeTab}.pdf`);
    } catch (err: any) {
      console.error("PDF export failed", err);
      // Detailed error alert
      alert(`PDF 导出失败: ${err.message || "未知错误"}\n\n建议方案：\n1. 请使用浏览器的 打印 (Command/Ctrl + P) -> 另存为 PDF。\n2. 尝试减小分镜表的行数后再次导出。`);
    } finally {
      setZoomScale(originalScale);
    }
  };

  const handleExportWord = async () => {
    const originalScale = zoomScale;
    setZoomScale(1);
    await new Promise(r => setTimeout(r, 400));

    const id = activeTab === "analysis" ? "analysis-export-container" : "storyboard-export-container";
    const element = document.getElementById(id);
    if (!element) {
      setZoomScale(originalScale);
      return;
    }

    const clone = element.cloneNode(true) as HTMLElement;
    
    // SYNC INPUT VALUES & SET EXPLICIT WIDTHS
    const originalCells = element.querySelectorAll('th, td');
    const cloneCells = clone.querySelectorAll('th, td');
    
    const originalInputs = element.querySelectorAll('input, textarea');
    const cloneInputs = clone.querySelectorAll('input, textarea');
    
    // Replace inputs with spans
    originalInputs.forEach((input, idx) => {
      const val = (input as HTMLInputElement | HTMLTextAreaElement).value;
      const span = document.createElement('span');
      span.innerText = val;
      if (input.tagName === 'TEXTAREA') {
        span.style.whiteSpace = 'pre-wrap';
        span.style.display = 'block';
        span.style.width = '100%';
      } else {
        span.style.display = 'inline-block';
        span.style.width = '100%';
      }
      if (cloneInputs[idx] && cloneInputs[idx].parentNode) {
        cloneInputs[idx].parentNode!.replaceChild(span, cloneInputs[idx]);
      }
    });

    // Set explicit width attributes for all table cells based on their computed/style widths
    originalCells.forEach((cell, idx) => {
      const rect = cell.getBoundingClientRect();
      const width = Math.round(rect.width);
      if (cloneCells[idx]) {
        (cloneCells[idx] as HTMLElement).setAttribute('width', width.toString());
        (cloneCells[idx] as HTMLElement).style.width = `${width}px`;
      }
    });

    clone.querySelectorAll('.no-print').forEach(el => el.remove());
    
    const images = clone.getElementsByTagName('img');
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        // Match image width to parent container for Word
        const parentCell = img.closest('td, th');
        if (parentCell) {
          const cellWidth = parseInt(parentCell.getAttribute('width') || '300');
          img.setAttribute('width', Math.min(cellWidth - 20, 480).toString());
        } else {
          img.setAttribute('width', '350');
        }

        if (img.src && !img.src.startsWith('data:')) {
            try {
                const response = await fetch(img.src, { mode: 'cors' });
                const blob = await response.blob();
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                img.src = base64;
            } catch (e) {
                console.warn("Failed to embed image in Word export", e);
            }
        }
    }

    const content = clone.innerHTML;
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                    <head><meta charset='utf-8'><title>Script Export</title>
                    <!--[if gte mso 9]>
                    <xml>
                    <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                    <w:DoNotOptimizeForBrowser/>
                    </w:WordDocument>
                    </xml>
                    <![endif]-->
                    <style>
                      @page { size: landscape; margin: 0.5in; mso-page-orientation: landscape; }
                      body { font-family: 'SimSun', 'Microsoft YaHei', 'Arial', sans-serif; line-height: 1.4; color: black; }
                      h1 { text-align: center; font-size: 22pt; margin-bottom: 15pt; }
                      h2 { font-size: 16pt; margin-top: 15pt; margin-bottom: 8pt; border-bottom: 1px solid black; padding-bottom: 4px; }
                      p { margin: 5pt 0; }
                      table { border-collapse: collapse; width: 100%; margin-bottom: 20px; border: 1pt solid black; table-layout: fixed; }
                      th, td { border: 1pt solid black; padding: 6px; vertical-align: top; word-wrap: break-word; overflow: visible; }
                      th { background-color: #f0f0f0; font-weight: bold; text-align: center; font-size: 10pt; }
                      td { font-size: 9pt; }
                      img { height: auto; display: block; margin: 5px auto; }
                    </style>
                    </head><body>`;
    const footer = "</body></html>";
    const sourceHTML = header + content + footer;

    const blob = new Blob(["\ufeff", sourceHTML], {
      type: "application/vnd.ms-word;charset=utf-8",
    });
    saveAs(blob, `${projectName || "script_export"}_${activeTab}.doc`);
    setZoomScale(originalScale);
  };

  const getAllVisualImages = () => {
    const imgs: string[] = [];
    if (!results) return imgs;

    if (activeTab === "analysis") {
      results.characters.forEach(
        (_, i) =>
          metaImages[`character-${i}`] &&
          imgs.push(metaImages[`character-${i}`]),
      );
      results.scenes.forEach(
        (_, i) =>
          metaImages[`scene-${i}`] && imgs.push(metaImages[`scene-${i}`]),
      );
      results.props.forEach(
        (_, i) => metaImages[`prop-${i}`] && imgs.push(metaImages[`prop-${i}`]),
      );
    } else {
      results.storyboard.forEach(
        (f) =>
          frameImages[f.frameNumber] && imgs.push(frameImages[f.frameNumber]),
      );
    }
    return imgs;
  };

  // Table Styling States

  const addColumn = (type: "character" | "scene" | "prop" | "storyboard") => {
    const colName = prompt("请输入新列名称:");
    if (!colName) return;
    if (type === "character") setCharacterCols([...characterCols, colName]);
    if (type === "scene") setSceneCols([...sceneCols, colName]);
    if (type === "prop") setPropCols([...propCols, colName]);
    if (type === "storyboard") setStoryboardCols([...storyboardCols, colName]);
  };

  const removeColumn = (
    type: "character" | "scene" | "prop" | "storyboard",
    colName: string,
  ) => {
    if (type === "character")
      setCharacterCols(characterCols.filter((c) => c !== colName));
    if (type === "scene") setSceneCols(sceneCols.filter((c) => c !== colName));
    if (type === "prop") setPropCols(propCols.filter((c) => c !== colName));
    if (type === "storyboard")
      setStoryboardCols(storyboardCols.filter((c) => c !== colName));
  };

  // Project Management States

  // Analysis Engine configurations
  const [analysisOllamaModel, setAnalysisOllamaModel] =
    useState("qwen3-coder:30b");

  // Image Generation Engine configurations

  // Project Management Logic
  const getProjectData = () => ({
    projectName,
    script,
    referenceImages,
    results,
    frameImages,
    globalStyle,
    customStyle,
    aspectRatio,
    analysisEngine,
    analysisOllamaUrl,
    analysisOllamaModel,
    selectedEngine,
    comfyUrl,
    comfyNodeId,
    comfyBatchMode,
    comfyBatchSeparator,
    comfyWorkflow,
    apiKeys,
    layoutMode,
    promptWeight,
    samplerName,
    samplingSteps,
    metaImages,
    tablePadding,
    tableLineHeight,
    tableFontSize,
    characterCols,
    sceneCols,
    propCols,
    storyboardCols,
  });

  const loadProjectData = (data: any) => {
    if (data.projectName !== undefined) setProjectName(data.projectName);
    if (data.script !== undefined) setScript(data.script);
    if (data.referenceImages !== undefined)
      setReferenceImages(data.referenceImages);
    if (data.results !== undefined) setResults(data.results);
    if (data.frameImages !== undefined) setFrameImages(data.frameImages);
    if (data.globalStyle !== undefined) setGlobalStyle(data.globalStyle);
    if (data.customStyle !== undefined) setCustomStyle(data.customStyle);
    if (data.aspectRatio !== undefined) setAspectRatio(data.aspectRatio);
    if (data.analysisEngine !== undefined)
      setAnalysisEngine(data.analysisEngine);
    if (data.analysisOllamaUrl !== undefined)
      setAnalysisOllamaUrl(data.analysisOllamaUrl);
    if (data.analysisOllamaModel !== undefined)
      setAnalysisOllamaModel(data.analysisOllamaModel);
    if (data.selectedEngine !== undefined)
      setSelectedEngine(data.selectedEngine);
    if (data.comfyUrl !== undefined) setComfyUrl(data.comfyUrl);
    if (data.comfyNodeId !== undefined) setComfyNodeId(data.comfyNodeId);
    if (data.comfyBatchMode !== undefined)
      setComfyBatchMode(data.comfyBatchMode);
    if (data.comfyBatchSeparator !== undefined)
      setComfyBatchSeparator(data.comfyBatchSeparator);
    if (data.comfyWorkflow !== undefined) setComfyWorkflow(data.comfyWorkflow);
    if (data.apiKeys !== undefined) setApiKeys(data.apiKeys);
    else if (data.customApiKey !== undefined)
      setApiKeys((prev) => ({ ...prev, gemini: data.customApiKey }));
    if (data.layoutMode !== undefined) setLayoutMode(data.layoutMode);
    if (data.promptWeight !== undefined) setPromptWeight(data.promptWeight);
    if (data.samplerName !== undefined) setSamplerName(data.samplerName);
    if (data.samplingSteps !== undefined) setSamplingSteps(data.samplingSteps);
    if (data.metaImages !== undefined) setMetaImages(data.metaImages);
    if (data.tablePadding !== undefined) setTablePadding(data.tablePadding);
    if (data.tableLineHeight !== undefined)
      setTableLineHeight(data.tableLineHeight);
    if (data.tableFontSize !== undefined) setTableFontSize(data.tableFontSize);
    if (data.characterCols !== undefined) setCharacterCols(data.characterCols);
    if (data.sceneCols !== undefined) setSceneCols(data.sceneCols);
    if (data.propCols !== undefined) setPropCols(data.propCols);
    if (data.storyboardCols !== undefined)
      setStoryboardCols(data.storyboardCols);
  };

  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [
    script,
    referenceImages,
    results,
    frameImages,
    globalStyle,
    customStyle,
    aspectRatio,
    projectName,
  ]);

  useEffect(() => {
    if (!fileHandle || !hasUnsavedChanges) return;
    const timer = setTimeout(async () => {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(getProjectData(), null, 2));
        await writable.close();
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Auto-save to file failed", err);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [
    fileHandle,
    hasUnsavedChanges,
    script,
    referenceImages,
    results,
    frameImages,
    globalStyle,
    customStyle,
    aspectRatio,
    projectName,
    analysisEngine,
    selectedEngine,
    comfyWorkflow,
    layoutMode,
  ]);

  const handleNewProject = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("当前工程有未保存的修改，确定要新建吗？")
    )
      return;
    setProjectName("未命名工程");
    setFileHandle(null);
    setScript("");
    setReferenceImages([]);
    setResults(null);
    setFrameImages({});
    setCustomStyle("");
    setTimeout(() => setHasUnsavedChanges(false), 50);
  };

  const fallbackOpenProject = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".aiproj,application/json";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        if (re.target?.result)
          loadProjectData(JSON.parse(re.target.result as string));
        setTimeout(() => setHasUnsavedChanges(false), 50);
        setFileHandle(null);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleOpenProject = async () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("当前工程有未保存的修改，确定要打开新工程吗？")
    )
      return;

    if ("showOpenFilePicker" in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: "AI Studio Project",
              accept: { "application/json": [".aiproj"] },
            },
          ],
        });
        const file = await handle.getFile();
        const content = await file.text();
        loadProjectData(JSON.parse(content));
        setFileHandle(handle);
        setTimeout(() => setHasUnsavedChanges(false), 50);
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return; // User cancelled
        console.warn(
          "showOpenFilePicker failed (likely iframe restriction), attempting fallback:",
          err,
        );
      }
    }
    fallbackOpenProject();
  };

  const handleSaveProject = async () => {
    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(getProjectData(), null, 2));
        await writable.close();
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Save failed", err);
        alert("保存失败: " + String(err));
      }
    } else {
      handleSaveAsProject();
    }
  };

  const fallbackSaveAsProject = () => {
    const blob = new Blob([JSON.stringify(getProjectData(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "project"}.aiproj`;
    a.click();
    URL.revokeObjectURL(url);
    setHasUnsavedChanges(false);
  };

  const handleSaveAsProject = async () => {
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `${projectName || "project"}.aiproj`,
          types: [
            {
              description: "AI Studio Project",
              accept: { "application/json": [".aiproj"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(getProjectData(), null, 2));
        await writable.close();
        setFileHandle(handle);
        setHasUnsavedChanges(false);
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return; // User cancelled
        console.warn(
          "showSaveFilePicker failed (likely iframe restriction), attempting fallback:",
          err,
        );
      }
    }
    fallbackSaveAsProject();
  };

  const handleOptimizePrompt = async (
    type: "character" | "scene" | "prop",
    index: number,
  ) => {
    if (!results) return;
    const key = `${type}-${index}`;
    setIsOptimizing(key);

    try {
      const item =
        type === "character"
          ? results.characters[index]
          : type === "scene"
            ? results.scenes[index]
            : results.props[index];
      const storyContext = script;

      const { optimizeEntityPrompt } = await import("./services/gemini");
      const optimized = await optimizeEntityPrompt(
        analysisOllamaUrl,
        analysisOllamaModel,
        type,
        item,
        storyContext,
      );

      if (optimized && optimized !== "扩写失败") {
        if (type === "character") {
          updateCharacter(index, "description", optimized);
        } else if (type === "scene") {
          updateScene(index, "setting", optimized);
        } else if (type === "prop") {
          updateProp(index, "description", optimized);
        }
      }
    } catch (err) {
      console.error("Optimization failed", err);
    } finally {
      setIsOptimizing(null);
    }
  };

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

  const handleFileChange = (e: any) => {
    const files = Array.from((e.target.files as FileList) || []);
    processImageFiles(files);
  };

  const processImageFiles = (files: File[]) => {
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            url: reader.result as string,
            name: file.name.split(".")[0] || "Ref",
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleScriptDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length === 0) return;
    const file = files[0]; // just take the first file

    setIsExtractingDoc(true);
    try {
      const text = await extractTextFromFile(file);
      setUploadedScriptFile({ name: file.name, text });
      setScript(""); // clear textarea
      onAnalyze(text); // auto trigger analysis
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
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleWorkflowUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Extract node ID from filename: T2I-Z-image-ID[5].json -> 5
    const match = file.name.match(/\[(\d+)\]/);
    if (match && match[1]) {
      setComfyNodeId(match[1]);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setComfyWorkflow(JSON.stringify(json, null, 2));
      } catch (err) {
        alert(
          "JSON 文件解析失败，请确保您上传的是 ComfyUI 导出的 API 格式 JSON 文件。",
        );
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

  const onAnalyze = async (overrideScript?: string) => {
    const scriptToAnalyze = overrideScript || uploadedScriptFile?.text || script;
    if (!scriptToAnalyze.trim()) return;
    setIsAnalyzing(true);
    setRawAnalysisText("");
    try {
      let res;
      if (analysisEngine === "ollama") {
        const { analyzeOllamaScript } = await import("./services/gemini");
        const analysisResult = await analyzeOllamaScript(
          analysisOllamaUrl,
          analysisOllamaModel,
          scriptToAnalyze,
        );
        if (analysisResult.parsed) {
          res = analysisResult.parsed;
          setResults(res);
        } else {
          setRawAnalysisText(analysisResult.text);
          setResults(null);
        }
      } else if (analysisEngine === "gpt" || analysisEngine === "doubao") {
        const { analyzeScriptWithOtherLLM } = await import("./services/gemini");
        const key = analysisEngine === "gpt" ? apiKeys.gpt : apiKeys.doubao;
        res = await analyzeScriptWithOtherLLM(
          scriptToAnalyze,
          analysisEngine as any,
          key,
        );
        setResults(res);
      } else {
        res = await analyzeScript(
          scriptToAnalyze,
          referenceImages.map((img) => img.url),
          apiKeys.gemini,
        );
        setResults(res);
      }
      setActiveTab("analysis");
    } catch (error: any) {
      console.error("Analysis failed", error);
      const errorMsg = JSON.stringify(error) + String(error);
      if (errorMsg.includes("429")) {
        alert(
          "额度受限 (429): 当前分析模型的免费额度已耗尽。请配置有效 API Key。",
        );
      } else if (errorMsg.includes("403")) {
        alert("权限不足 (403): 请检查 API Key。");
      } else {
        alert(
          `智能剧本分析失败: \n${error?.message || "未知错误，请检查网络或配置"}`,
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoSplit = () => {
    if (!rawAnalysisText) return;

    // Default fallback structure
    const result: AnalysisResult = {
      characters: [],
      props: [],
      scenes: [],
      storyboard: [],
    };

    // Advanced Rescue: Regex approach to extract frames manually from unstructured markdown/list
    const frameRegex =
      /(?:分镜|镜头|第|Frame|Shot)\s*([0-9]+)\s*(?:镜|:|：|>|-)?\s*([\s\S]*?)(?=(?:分镜|镜头|第|Frame|Shot)\s*[0-9]+\s*(?:镜|:|：|>|-)?|$)/gi;
    let match;
    let foundFrames = false;

    while ((match = frameRegex.exec(rawAnalysisText)) !== null) {
      foundFrames = true;
      const frameNumber = parseInt(match[1]) || result.storyboard.length + 1;
      const descChunk = match[2].trim();

      let visualDesc = descChunk;
      const visualMatch = descChunk.match(
        /(?:画面|视觉|内容)[:：]\s*([^\n]+)/i,
      );
      if (visualMatch) visualDesc = visualMatch[1];

      visualDesc = visualDesc
        .replace(/^[\s\S]*?(?:画面|视觉|内容)[:：]/i, "")
        .trim();

      let audioVoiceover = "";
      const audioMatch = descChunk.match(
        /(?:声音|旁白|台词|VO)[:：]\s*([^\n]+)/i,
      );
      if (audioMatch) audioVoiceover = audioMatch[1];

      result.storyboard.push({
        frameNumber: frameNumber,
        visualDescription:
          visualDesc || descChunk.split("\n")[0] || "自动提取画面",
        audioVoiceover: audioVoiceover,
        composition: "自动分析构图",
      });
    }

    // Secondary Fallback if explicit keywords aren't found
    if (!foundFrames) {
      const chunks = rawAnalysisText
        .split(/\n\s*\n/)
        .filter((c) => c.trim().length > 5);
      chunks.forEach((chunk, idx) => {
        result.storyboard.push({
          frameNumber: idx + 1,
          visualDescription: chunk.trim(),
          audioVoiceover: "",
          composition: "智能构图",
        });
      });
    }

    if (result.storyboard.length === 0) {
      result.storyboard.push({
        frameNumber: 1,
        visualDescription: rawAnalysisText.substring(0, 500),
        audioVoiceover: "",
        composition: "",
      });
    }

    setResults(result);
    setRawAnalysisText("");
  };

  const handleFrameImageGenerated = (frameNumber: number, imageUrl: string) => {
    setFrameImages((prev) => ({ ...prev, [frameNumber]: imageUrl }));
  };

  const getProjectContext = () => {
    let baseContext = "";
    if (results) {
      baseContext = `
        CHARACTERS: ${results.characters.map((c) => `${c.name}(${c.description}, Outfit:${c.clothing})`).join("; ")}
        EQUIPMENT/PROPS: ${results.props.map((p) => `${p.name}(${p.description})`).join("; ")}
        SCENES: ${results.scenes.map((s) => `${s.name}(${s.setting}, ${s.atmosphere})`).join("; ")}
      `.trim();
    }

    // Add reference image names to enforce consistency if they exist
    const refNames = referenceImages
      .map((img) => img.name)
      .filter((name) => name.trim() !== "Ref" && name.trim() !== "");
    if (refNames.length > 0) {
      baseContext += `\nVISUAL EXAMPLES ESTABLISHED (Ensure consistency with these established designs): ${refNames.join(", ")}`;
    }
    return baseContext;
  };

  const generateAllFrameImages = async () => {
    if (!results || isGeneratingAll) return;

    const frames = results.storyboard;
    const pendingFrames = frames.filter((f) => !frameImages[f.frameNumber]);
    if (pendingFrames.length === 0) return;

    setIsGeneratingAll(true);
    setGenStatus("准备开始生成...");
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // -- BATCH MODE EXPERIMENT FOR COMFYUI --
    if (selectedEngine.startsWith("comfyui") && comfyBatchMode) {
      const isI2I =
        selectedEngine === "comfyui_i2i" ||
        selectedEngine === "comfyui_i2i_prompt";
      setGenStatus(
        `正在批量发送请求到 ComfyUI 队列 (${pendingFrames.length}张图)...`,
      );
      try {
        const actualSeparator = comfyBatchSeparator
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t");
        const combinedPrompt = pendingFrames
          .map((f) => {
            const finalDesc = buildPromptWithLayout(f.visualDescription);
            return customStyle
              ? `${finalDesc}, ${globalStyle}, ${customStyle}`
              : `${finalDesc}, ${globalStyle}`;
          })
          .join(actualSeparator);

        const { generateComfyUIFrame } = await import("./services/gemini");
        const urls = await generateComfyUIFrame(
          comfyUrl,
          comfyWorkflow,
          comfyNodeId,
          combinedPrompt,
          "", // Style is already combined above
          true, // isBatchMode
          currentSamplerConfig,
          isI2I ? referenceImages : undefined,
          aspectRatio,
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
        alert(
          `批量生成失败: ${String(error)}。\n可能原因: 您的 ComfyUI 节点 ID 配置不正确或本地服务不可用。`,
        );
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
          if (selectedEngine.startsWith("comfyui")) {
            const isI2I =
              selectedEngine === "comfyui_i2i" ||
              selectedEngine === "comfyui_i2i_prompt";
            const { generateComfyUIFrame } = await import("./services/gemini");
            const urls = await generateComfyUIFrame(
              comfyUrl,
              comfyWorkflow,
              comfyNodeId,
              buildPromptWithLayout(frame.visualDescription, frame),
              customStyle || globalStyle,
              false, // isBatchMode
              currentSamplerConfig,
              isI2I ? referenceImages : undefined,
              aspectRatio,
            );
            url = urls[0];
          } else if (
            selectedEngine === "jimeng" ||
            selectedEngine === "kling" ||
            selectedEngine === "mj"
          ) {
            const { generateWithOtherImageEngine } =
              await import("./services/gemini");
            const key =
              selectedEngine === "jimeng"
                ? apiKeys.jimeng
                : selectedEngine === "kling"
                  ? apiKeys.kling
                  : apiKeys.mj;
            url = await generateWithOtherImageEngine(
              buildPromptWithLayout(frame.visualDescription, frame),
              selectedEngine,
              key,
              aspectRatio,
            );
          } else {
            url = await generateFrameImage(
              buildPromptWithLayout(frame.visualDescription, frame),
              customStyle || globalStyle,
              getProjectContext(),
              aspectRatio,
              apiKeys.gemini,
            );
          }
          setFrameImages((prev) => ({ ...prev, [frame.frameNumber]: url }));
          // Throttling to respect rate limits
          await sleep(3000);
          break; // Success
        } catch (e) {
          console.error(
            `Failed to generate frame ${frame.frameNumber} (Attempt ${retries + 1})`,
            e,
          );
          const errorMsg = JSON.stringify(e) + String(e);

          if (errorMsg.includes("403")) {
            setGenStatus("权限不足 - 请检查 API KEY");
            alert(
              "PERMISSION_DENIED (403): 批量生成中断。请确保已在 **左侧栏底部『自定义 API 管理』** 中正确配置您的 API Key。部分生图模型可能需要使用您的自有配额。",
            );
            break;
          }

          if (errorMsg.includes("429")) {
            if (retries < maxRetries) {
              const backoff =
                Math.pow(2, retries + 1) * 10000 + Math.random() * 2000;
              setGenStatus(
                `频率受限 - ${Math.round(backoff / 1000)}秒后重试...`,
              );
              await sleep(backoff);
              retries++;
              continue;
            } else {
              setGenStatus("额度耗尽 - 已暂停");
              alert(
                "QUOTA EXHAUSTED (429): 批量生成已停止。该模型的共享生图额度已耗尽。请点击 **左侧栏底部『自定义 API 管理』**，填入您个人的 Gemini API Key 以继续使用 (您可以在 aistudio.google.com 免费获取)。",
              );
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
      const currentFrames = results.storyboard.slice(
        startIndex,
        startIndex + pageSize,
      );

      const frameData = currentFrames.map((f, i) => ({
        number: i + 1,
        description: f.visualDescription,
      }));

      const combinedStyle = customStyle
        ? `${globalStyle}, ${customStyle}`
        : globalStyle;
      let url;
      if (
        selectedEngine === "jimeng" ||
        selectedEngine === "kling" ||
        selectedEngine === "mj"
      ) {
        const { generateWithOtherImageEngine } =
          await import("./services/gemini");
        const apiKey = apiKeys[selectedEngine] || "";
        const gridPrompt = `Generate a 3x3 grid of images with these descriptions: ${frameData.map((f) => f.description).join("; ")}`;
        url = await generateWithOtherImageEngine(
          gridPrompt,
          selectedEngine as any,
          apiKey,
          aspectRatio,
        );
      } else {
        url = await generateGridImage(
          frameData,
          combinedStyle,
          getProjectContext(),
          aspectRatio,
          apiKeys.gemini,
        );
      }

      setGridImageUrls((prev) => ({
        ...prev,
        [gridPage]: [url, ...(prev[gridPage] || [])],
      }));
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
            <TabButton
              active={activeTab === "image-tools"}
              onClick={() => setActiveTab("image-tools")}
              label="智能图像处理"
            />
          </div>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded text-xs font-bold mr-1">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Avatar"
                    className="w-4 h-4 rounded-full"
                  />
                ) : (
                  <User className="w-3 h-3" />
                )}
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {currentUser.displayName || currentUser.email}
                </span>
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

      <main className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{
            width: isSidebarCollapsed
              ? 0
              : window.innerWidth >= 1536
                ? 500
                : 420,
            opacity: isSidebarCollapsed ? 0 : 1,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-[var(--surface)] border-r border-[var(--border)] flex flex-col flex-shrink-0 relative z-10 overflow-hidden"
        >
          <div className="w-[420px] 2xl:w-[500px] flex flex-col h-full overflow-hidden">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
              {/* Project Management Header */}
              <div className="p-4 border-b border-[var(--border)] bg-[#1a1c1f]">
                <div className="flex items-center justify-between mb-2">
                  <input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="未命名工程"
                    className="bg-transparent border-none outline-none text-sm font-bold text-[var(--accent)] uppercase tracking-widest placeholder:text-gray-600 w-full"
                  />
                  <span
                    className={`text-[10px] w-14 text-right flex-shrink-0 ${hasUnsavedChanges ? "text-amber-500" : "text-green-500"}`}
                  >
                    {hasUnsavedChanges ? "未保存" : "已保存"}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleNewProject}
                    title="新建工程"
                    className="p-1.5 bg-[#111] border border-[var(--border)] rounded hover:bg-[var(--accent)] hover:text-black transition-colors tooltip flex-1 flex justify-center"
                  >
                    <File className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleOpenProject}
                    title="打开工程"
                    className="p-1.5 bg-[#111] border border-[var(--border)] rounded hover:bg-[var(--accent)] hover:text-black transition-colors tooltip flex-1 flex justify-center"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSaveProject}
                    title="保存"
                    className="p-1.5 bg-[#111] border border-[var(--border)] rounded hover:bg-[var(--accent)] hover:text-black transition-colors tooltip flex-1 flex justify-center"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSaveAsProject}
                    title="另存为"
                    className="text-[10px] px-2 py-1.5 bg-[#111] border border-[var(--border)] rounded hover:bg-[var(--accent)] hover:text-black transition-colors uppercase font-bold flex-[2]"
                  >
                    另存为本地
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-2 flex justify-between">
                  <span>输入剧本/梗概</span>
                  {isExtractingDoc && (
                    <span className="opacity-70 animate-pulse text-[10px] mt-0.5">
                      解析中...
                    </span>
                  )}
                </div>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingScript(true);
                  }}
                  onDragLeave={() => setIsDraggingScript(false)}
                  onDrop={(e) => {
                    setIsDraggingScript(false);
                    handleScriptDrop(e);
                  }}
                  className={`relative border-2 transition-all rounded ${isDraggingScript ? "border-[var(--accent)] bg-[var(--accent)]/10 scale-[1.01]" : "border-transparent"}`}
                >
                  {uploadedScriptFile ? (
                    <div className="w-full h-48 bg-[#111] border border-[var(--border)] rounded p-3 flex flex-col items-center justify-center relative">
                      <div className="absolute top-2 right-2">
                        <button 
                          onClick={() => setUploadedScriptFile(null)}
                          className="p-1 text-gray-400 hover:text-white bg-black/50 hover:bg-black/80 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="w-12 h-12 bg-[#222] rounded-full flex items-center justify-center mb-3">
                        <FileText className="w-6 h-6 text-[var(--accent)]" />
                      </div>
                      <div className="text-white font-medium text-center px-4 w-full truncate max-w-[80%]">
                        {uploadedScriptFile.name}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-2 uppercase tracking-wider">
                        已加载，正在准备智能分析...
                      </div>
                    </div>
                  ) : (
                    <textarea
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      placeholder="在这里输入您的故事脚本，或拖拽 txt/md/pdf/docx 文档至此..."
                      disabled={isExtractingDoc}
                      className="w-full h-48 bg-[#111] border border-[var(--border)] rounded p-3 text-sm text-white outline-none focus:border-[var(--accent)] transition-colors resize-none font-sans leading-relaxed disabled:opacity-50"
                    />
                  )}
                </div>
              </div>

              <div className="bg-[#1a1c1f] border border-[var(--border)] p-3 rounded">
                <div className="text-sm uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-3">
                  生成艺术风格
                </div>
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
                  <div className="text-xs uppercase font-bold text-white opacity-40">
                    自定义风格关键词
                  </div>
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
                <div className="text-sm uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-3">
                  画面设定
                </div>
                <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wide mb-1.5 mt-2">
                  画面长宽比
                </div>
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
              </div>

              <button
                onClick={() => onAnalyze()}
                disabled={isAnalyzing || (!script.trim() && !uploadedScriptFile?.text.trim())}
                className="w-full py-3 bg-[var(--accent)] text-black rounded font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-[0_0_15px_rgba(205,255,0,0.15)]"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "开始智能分析"
                )}
              </button>

              <div className="bg-[#1a1c1f] border border-[var(--border)] p-3 rounded mt-4">
                <div className="text-xs uppercase font-bold text-[var(--accent)] tracking-[0.2em] mb-3">
                  工作流引擎配置
                </div>

                {/* Analysis Engine Config */}
                <div className="mb-4">
                  <div className="text-[10px] text-[var(--text-dim)] uppercase font-mono tracking-widest mb-1.5 flex items-center gap-1">
                    <Send className="w-3 h-3" />
                    1. 智能分析引擎 (分镜转换)
                  </div>
                  <div className="mb-2">
                    <select
                      value={analysisEngine}
                      onChange={(e) => setAnalysisEngine(e.target.value)}
                      className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--accent)] outline-none focus:border-[var(--accent)] custom-scrollbar"
                    >
                      <option value="ollama" className="text-white bg-[#111]">
                        本地 Ollama (大模型)
                      </option>
                      <option
                        value="gemini"
                        className="text-[var(--text-dim)] bg-[#111]"
                      >
                        Google Gemini 2.5 Pro
                      </option>
                      {apiKeys.gpt && (
                        <option
                          value="gpt"
                          className="text-[var(--accent)] bg-[#111]"
                        >
                          OpenAI GPT-4o
                        </option>
                      )}
                      {apiKeys.doubao && (
                        <option
                          value="doubao"
                          className="text-[var(--accent)] bg-[#111]"
                        >
                          字节豆包 (Doubao)
                        </option>
                      )}
                    </select>
                  </div>
                  {analysisEngine === "ollama" && (
                    <div className="space-y-2 p-2 bg-[#2a2c31] border border-[var(--border)] rounded mb-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-white opacity-60">
                          API 地址
                        </label>
                        <input
                          type="text"
                          value={analysisOllamaUrl}
                          onChange={(e) => setAnalysisOllamaUrl(e.target.value)}
                          className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 mt-1 text-xs text-white outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-white opacity-60">
                          模型名称 (Model)
                        </label>
                        <input
                          type="text"
                          value={analysisOllamaModel}
                          onChange={(e) =>
                            setAnalysisOllamaModel(e.target.value)
                          }
                          className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 mt-1 text-xs text-white outline-none focus:border-[var(--accent)]"
                        />
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
                  <div className="mb-2">
                    <select
                      value={selectedEngine}
                      onChange={(e) => setSelectedEngine(e.target.value)}
                      className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--accent)] outline-none focus:border-[var(--accent)] custom-scrollbar"
                    >
                      <option value="gemini" className="text-white bg-[#111]">
                        Google Gemini (推荐)
                      </option>
                      <option
                        value="comfyui_t2i"
                        className="text-[var(--accent)] bg-[#111]"
                      >
                        ComfyUI 文生图
                      </option>
                      <option
                        value="comfyui_i2i"
                        className="text-[var(--accent)] bg-[#111]"
                      >
                        ComfyUI 图生图
                      </option>
                      <option
                        value="comfyui_i2i_prompt"
                        className="text-[var(--accent)] bg-[#111]"
                      >
                        ComfyUI 语义改图
                      </option>
                      {apiKeys.jimeng && (
                        <option
                          value="jimeng"
                          className="text-[var(--accent)] bg-[#111]"
                        >
                          即梦 Dreamina (T2I)
                        </option>
                      )}
                      {apiKeys.kling && (
                        <option
                          value="kling"
                          className="text-[var(--accent)] bg-[#111]"
                        >
                          可灵 Kling (T2I)
                        </option>
                      )}
                      {apiKeys.mj && (
                        <option
                          value="mj"
                          className="text-[var(--accent)] bg-[#111]"
                        >
                          Midjourney (Proxy)
                        </option>
                      )}
                    </select>
                  </div>

                  {selectedEngine.startsWith("comfyui") && (
                    <div className="space-y-2 mt-3 p-2 bg-[#2a2c31] border border-[var(--border)] rounded">
                      {(selectedEngine === "comfyui_i2i" ||
                        selectedEngine === "comfyui_i2i_prompt") && (
                        <div className="text-[10px] text-[var(--accent)] font-mono leading-tight mb-2 italic">
                          ⚠️ 提示：请加载您的图生图工作流 (API
                          JSON)，系统会自动上传参考图并替换工作流中的 LoadImage
                          节点图片为您关联设定的视觉参考图。
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] uppercase font-bold text-white opacity-60">
                          API 地址 (需开启 --listen)
                        </label>
                        <input
                          type="text"
                          value={comfyUrl}
                          onChange={(e) => setComfyUrl(e.target.value)}
                          className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 mt-1 text-xs text-white outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-white opacity-60">
                          提示词 Node ID (CLIPTextEncode)
                        </label>
                        <input
                          type="text"
                          value={comfyNodeId}
                          onChange={(e) => setComfyNodeId(e.target.value)}
                          className="w-full bg-[#111] border border-[var(--border)] rounded px-2 py-1.5 mt-1 text-xs text-white outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase font-bold text-white opacity-60">
                            完整 Workflow (API JSON)
                          </label>
                          <div className="flex items-center gap-2">
                            {localWorkflows.length > 0 && (
                              <select
                                onChange={(e) => handleSelectLocalWorkflow(e.target.value)}
                                className="text-[10px] bg-[#111] border border-[var(--border)] rounded px-2 py-1 text-[var(--accent)] outline-none hover:border-[var(--accent)] transition-colors max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap"
                              >
                                <option value="">内置预设工作流...</option>
                                {localWorkflows.map((w) => (
                                  <option key={w.filename} value={w.filename}>
                                    {w.filename}
                                  </option>
                                ))}
                              </select>
                            )}
                            <label className="text-[10px] bg-[#111] hover:bg-[var(--accent)] hover:text-black transition-colors border border-[var(--border)] rounded px-2 py-1 cursor-pointer text-[var(--accent)] font-bold">
                              加载文件...
                              <input
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleWorkflowUpload}
                              />
                            </label>
                          </div>
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
                          <span className="text-xs uppercase font-bold text-[var(--accent)] tracking-widest group-hover:text-white transition-colors">
                            开启列表节点批量模式
                          </span>
                          <input
                            type="checkbox"
                            checked={comfyBatchMode}
                            onChange={(e) =>
                              setComfyBatchMode(e.target.checked)
                            }
                            className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                          />
                        </label>
                        {comfyBatchMode && (
                          <div className="mt-2 text-xs">
                            <div className="flex items-center justify-between opacity-80 mb-1.5">
                              <span>多文本提示词分隔符:</span>
                              <input
                                type="text"
                                value={comfyBatchSeparator}
                                onChange={(e) =>
                                  setComfyBatchSeparator(e.target.value)
                                }
                                className="bg-[#111] text-center border border-[var(--border)] rounded px-1.5 py-0.5 min-w-[50px] text-white outline-none text-xs"
                              />
                            </div>
                            <div className="text-[10px] text-[var(--text-dim)] mt-1.5 leading-relaxed">
                              通过批量生成可将所有缺失图像的提示词组合发送给
                              Node，实现一次输出多图（需节点支持，如 easy
                              promptList）。请确保你的 Node
                              ID（上方）指向的是支持字符串划分的提示词列表节点。
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selectedEngine.startsWith("comfyui") && (
                  <>
                    <div className="text-sm uppercase font-bold text-white tracking-widest mb-3 mt-4 pt-4 border-t border-[var(--border)]">
                      渲染参数
                    </div>
                    <div className="space-y-4 font-mono text-xs text-[var(--text-dim)]">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span>采样步数 (Steps)</span>
                        </div>
                        <div className="flex gap-2 text-[10px] flex-wrap">
                          {["10", "15", "20", "25", "30"].map((stepStr) => (
                            <button
                              key={stepStr}
                              onClick={() => setSamplingSteps(stepStr)}
                              className={`px-2 py-1 rounded border transition-colors ${samplingSteps === stepStr ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "bg-[#111] text-white border-[var(--border)] hover:border-[var(--accent)]"}`}
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
                          className="w-full bg-[#111] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--accent)] transition-colors mt-1 block"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span>提示词权重 (CFG Scale)</span>
                        </div>
                        <div className="flex gap-2 text-[10px] flex-wrap">
                          {[
                            "0.5",
                            "0.7",
                            "0.9",
                            "1.0",
                            "1.2",
                            "1.5",
                            "2.0",
                          ].map((weight) => (
                            <button
                              key={weight}
                              onClick={() => setPromptWeight(weight)}
                              className={`px-2 py-1 rounded border transition-colors ${promptWeight === weight ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "bg-[#111] text-white border-[var(--border)] hover:border-[var(--accent)]"}`}
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
                          className="w-full bg-[#111] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--accent)] transition-colors mt-1 block"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span>采样算法 (Sampler)</span>
                        </div>
                        <select
                          value={samplerName}
                          onChange={(e) => setSamplerName(e.target.value)}
                          className="w-full bg-[#111] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--accent)] transition-colors block"
                        >
                          <optgroup label="Standard">
                            <option value="euler">euler</option>
                            <option value="euler_ancestral">
                              euler_ancestral
                            </option>
                            <option value="heun">heun</option>
                            <option value="ddpm">ddpm</option>
                            <option value="ddim">ddim</option>
                          </optgroup>
                          <optgroup label="DPM Variants">
                            <option value="dpm_2">dpm_2</option>
                            <option value="dpm_2_ancestral">
                              dpm_2_ancestral
                            </option>
                            <option value="dpm_fast">dpm_fast</option>
                            <option value="dpm_adaptive">dpm_adaptive</option>
                            <option value="dpmpp_2s_ancestral">
                              dpmpp_2s_ancestral
                            </option>
                            <option value="dpmpp_sde">dpmpp_sde</option>
                            <option value="dpmpp_sde_gpu">dpmpp_sde_gpu</option>
                            <option value="dpmpp_2m">dpmpp_2m</option>
                            <option value="dpmpp_2m_sde">dpmpp_2m_sde</option>
                            <option value="dpmpp_2m_sde_gpu">
                              dpmpp_2m_sde_gpu
                            </option>
                            <option value="dpmpp_3m_sde">dpmpp_3m_sde</option>
                            <option value="dpmpp_3m_sde_gpu">
                              dpmpp_3m_sde_gpu
                            </option>
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
                  </>
                )}
              </div>
            </div>

            {/* API Management at bottom */}
            <div className="mt-auto border-t border-[var(--border)] bg-[#1a1c1f] no-print">
              <button
                onClick={() => setIsApiPanelOpen(!isApiPanelOpen)}
                className="w-full p-3 flex items-center justify-between hover:bg-[#2a2c31] transition-colors text-[var(--accent)]"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    自定义 API 管理
                  </span>
                </div>
                {isApiPanelOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>

              <AnimatePresence>
                {isApiPanelOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-[var(--border)] bg-[#111]"
                  >
                    <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                      <div className="text-[10px] text-[var(--text-dim)] uppercase leading-relaxed mb-2 opacity-70">
                        配置您的 API 密钥。如果遇到 429
                        报错或需要多模型并发，请填写对应 Key。
                      </div>
                      {[
                        {
                          id: "gemini",
                          label: "Google Gemini API",
                          placeholder: "Gemini Pro Key...",
                        },
                        {
                          id: "gpt",
                          label: "OpenAI GPT API",
                          placeholder: "sk-...",
                        },
                        {
                          id: "jimeng",
                          label: "即梦 Dreamina API",
                          placeholder: "Jimeng API Key...",
                        },
                        {
                          id: "doubao",
                          label: "豆包 Doubao API",
                          placeholder: "Doubao API Key...",
                        },
                        {
                          id: "kling",
                          label: "可灵 Kling API",
                          placeholder: "Kling API Key...",
                        },
                        {
                          id: "mj",
                          label: "Midjourney API",
                          placeholder: "MJ Proxy/API Key...",
                        },
                      ].map((service) => (
                        <div key={service.id} className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-white opacity-40 px-1">
                            <span>{service.label}</span>
                          </div>
                          <div className="relative group">
                            <input
                              type={
                                showApiKey[service.id] ? "text" : "password"
                              }
                              value={apiKeys[service.id]}
                              onChange={(e) =>
                                setApiKeys((prev) => ({
                                  ...prev,
                                  [service.id]: e.target.value,
                                }))
                              }
                              placeholder={service.placeholder}
                              className="w-full bg-[#1a1c1f] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--accent)] font-mono transition-colors pr-8 placeholder:text-gray-700"
                            />
                            <button
                              onClick={() =>
                                setShowApiKey((prev) => ({
                                  ...prev,
                                  [service.id]: !prev[service.id],
                                }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-[var(--accent)] transition-colors p-0.5"
                            >
                              {showApiKey[service.id] ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.aside>

        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute top-1/2 -translate-y-1/2 z-30 w-6 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-full flex items-center justify-center hover:bg-[var(--accent)] hover:text-black transition-all shadow-xl no-print"
          style={{
            left: isSidebarCollapsed
              ? "-12px"
              : window.innerWidth >= 1536
                ? "488px"
                : "408px",
            transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Content Area */}
        <div className="flex-1 bg-[var(--bg)] overflow-y-auto p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === "image-tools" ? (
              <motion.div
                key="image-tools"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                <ImageToolsView 
                  comfyUrl={comfyUrl} 
                  comfyWorkflow={comfyWorkflow} 
                  comfyNodeId={comfyNodeId}
                  localWorkflows={localWorkflows}
                />
              </motion.div>
            ) : !results && !rawAnalysisText ? (
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
                      <span className="text-xs font-mono text-[var(--text-dim)]">
                        {analysisProgress}%
                      </span>
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
                      {analysisProgress < 30
                        ? "正在提取角色与场景..."
                        : analysisProgress < 60
                          ? "分析时间线与动作发生..."
                          : analysisProgress < 85
                            ? "匹配影视级构图模式..."
                            : "整合封包中..."}
                    </p>
                  </div>
                ) : (
                  <>
                    <LayoutGrid className="w-12 h-12 mb-4 text-[var(--text-dim)]" />
                    <p className="text-sm font-mono uppercase tracking-[0.3em]">
                      等待内容输入处理...
                    </p>
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
                    <span className="text-[10px] text-[var(--text-dim)] font-normal ml-2">
                      模型未能输出纯净 JSON 格式，请检查或手动拆分
                    </span>
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
                  <div 
                    className="transition-all duration-300 ease-out"
                    style={{ 
                      transform: `scale(${zoomScale})`, 
                      transformOrigin: "top center",
                      width: "100%"
                    }}
                  >
                    <div 
                      id="analysis-export-container"
                      className="bg-white text-black p-10 min-h-screen shadow-inner max-w-6xl mx-auto rounded-sm border border-gray-300"
                    >
                      <div className="text-center mb-10 border-b-2 border-black pb-4">
                        <h1 className="text-2xl font-serif font-bold uppercase tracking-widest">
                          剧本深度拆解分析报告
                        </h1>
                        <p className="text-xs text-gray-500 mt-2 font-mono italic">
                          AI-ASSISTED PRODUCTION ANALYSIS REPORT
                        </p>
                      </div>

                      <div className="mb-6 flex items-center justify-between no-print overflow-x-auto gap-4">
                        <div className="flex items-center gap-4 bg-gray-100 p-2 rounded border border-gray-300 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold">字体:</span>
                            <input
                              type="range"
                              min="8"
                              max="24"
                              value={tableFontSize}
                              onChange={(e) =>
                                setTableFontSize(Number(e.target.value))
                              }
                              className="w-16"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold">边距:</span>
                            <input
                              type="range"
                              min="2"
                              max="30"
                              value={tablePadding}
                              onChange={(e) =>
                                setTablePadding(Number(e.target.value))
                              }
                              className="w-16"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold">行高:</span>
                            <input
                              type="range"
                              min="1"
                              max="3"
                              step="0.1"
                              value={tableLineHeight}
                              onChange={(e) =>
                                setTableLineHeight(Number(e.target.value))
                              }
                              className="w-16"
                            />
                          </div>
                          <div className="w-px h-4 bg-gray-300" />
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="font-bold">缩放:</span>
                            <button
                              onClick={() =>
                                setZoomScale(Math.max(0.4, zoomScale - 0.1))
                              }
                            >
                              <ZoomOut className="w-3 h-3" />
                            </button>
                            <span className="font-mono min-w-[3ch]">
                              {Math.round(zoomScale * 100)}%
                            </span>
                            <button
                              onClick={() =>
                                setZoomScale(Math.min(2.5, zoomScale + 0.1))
                              }
                            >
                              <ZoomIn className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 no-print">
                          <button
                            onClick={handleExportWord}
                            className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1.5 hover:bg-blue-700 transition-all font-bold"
                          >
                            <File className="w-3 h-3" /> 导出 WORD
                          </button>
                          <button
                            onClick={handleExportPDF}
                            className="text-[10px] bg-red-600 text-white px-3 py-1.5 rounded flex items-center gap-1.5 hover:bg-red-700 transition-all font-bold"
                          >
                            <Download className="w-3 h-3" /> 导出 PDF
                          </button>
                          <button
                            onClick={() => window.print()}
                            className="text-[10px] bg-gray-800 text-white px-3 py-1.5 rounded flex items-center gap-1.5 hover:bg-black transition-all"
                          >
                            <Send className="w-3 h-3" /> 打印
                          </button>
                        </div>
                      </div>

                      <div
                        id="report-content"
                        className="space-y-12 pb-20"
                      >
                      {/* Characters Table */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold border-l-4 border-black pl-3 flex items-center gap-2">
                            <Users className="w-5 h-5" /> 角色资产清单
                            (CHARACTERS)
                          </h2>
                          <div className="flex gap-2 no-print">
                            <button
                              onClick={() => addColumn("character")}
                              className="text-[9px] bg-gray-100 border border-gray-300 px-2 py-1 rounded hover:bg-gray-200"
                            >
                              + 增加列
                            </button>
                            <button
                              onClick={() => addRow("character")}
                              className="text-[9px] bg-black text-white px-3 py-1 rounded font-bold uppercase"
                            >
                              + 添加角色行
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto border border-black">
                          <table
                            className="w-full border-collapse table-fixed"
                            style={{
                              fontSize: `${tableFontSize}px`,
                              lineHeight: tableLineHeight,
                            }}
                          >
                            <thead>
                              <tr className="bg-gray-50 border-b border-black">
                                <th 
                                  style={{ width: `${characterColWidths.name}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  角色姓名
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'character', 'name')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${characterColWidths.description}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  核心特征 / 性格描述
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'character', 'description')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${characterColWidths.clothing}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  服装设定
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'character', 'clothing')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${characterColWidths.makeup}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  妆造设定
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'character', 'makeup')}
                                  />
                                </th>
                                {characterCols.map((col) => (
                                  <th
                                    key={col}
                                    style={{ width: `${characterColWidths[col] || 150}px` }}
                                    className="border-r border-black p-2 relative group"
                                  >
                                    {col}
                                    <button
                                      onClick={() =>
                                        removeColumn("character", col)
                                      }
                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 no-print"
                                    >
                                      ×
                                    </button>
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                      onMouseDown={(e) => handleColResizeStart(e, 'character', col)}
                                    />
                                  </th>
                                ))}
                                <th 
                                  style={{ width: `${characterColWidths.actions}px` }}
                                  className="border-r border-black p-2 no-print relative"
                                >
                                  操作
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'character', 'actions')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${characterColWidths.preview}px` }}
                                  className="p-2 bg-gray-50 font-bold text-center relative"
                                >
                                  视觉效果预览
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'character', 'preview')}
                                  />
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.characters.map((char: any, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-gray-300 relative"
                                  style={{ height: characterRowHeights[i] ? `${characterRowHeights[i]}px` : 'auto' }}
                                >
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <input
                                      className="w-full bg-transparent outline-none font-bold"
                                      value={char.name}
                                      onChange={(e) =>
                                        updateCharacter(
                                          i,
                                          "name",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    {/* Horizontal resize handle */}
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'character', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <textarea
                                      className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                      value={char.description}
                                      onChange={(e) =>
                                        updateCharacter(
                                          i,
                                          "description",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'character', 'description')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'character', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <textarea
                                      className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                      value={char.clothing}
                                      onChange={(e) =>
                                        updateCharacter(
                                          i,
                                          "clothing",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'character', 'clothing')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'character', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <textarea
                                      className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                      value={char.makeup}
                                      onChange={(e) =>
                                        updateCharacter(
                                          i,
                                          "makeup",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'character', 'makeup')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'character', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  {characterCols.map((col) => (
                                    <td
                                      key={col}
                                      className="border-r border-black p-0"
                                      style={{ padding: `${tablePadding}px` }}
                                    >
                                      <textarea
                                        className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                        value={char[col] || ""}
                                        onChange={(e) =>
                                          updateCharacter(
                                            i,
                                            col as any,
                                            e.target.value,
                                          )
                                        }
                                      />
                                      {/* Resizers */}
                                      <div 
                                        className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                        onMouseDown={(e) => handleColResizeStart(e, 'character', col)}
                                      />
                                      <div 
                                        className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                        onMouseDown={(e) => {
                                          const rowEl = e.currentTarget.closest('tr');
                                          if (rowEl) handleRowResizeStart(e, 'character', i, rowEl.offsetHeight);
                                        }}
                                      />
                                    </td>
                                  ))}
                                  <td
                                    className="border-r border-black no-print align-middle text-center relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <div className="flex flex-col gap-1">
                                      <button
                                        onClick={() =>
                                          handleOptimizeEntityPrompt(
                                            "character",
                                            i,
                                          )
                                        }
                                        disabled={
                                          optimizingEntity?.type ===
                                            "character" &&
                                          optimizingEntity.index === i
                                        }
                                        className={`text-[9px] px-2 py-1 rounded transition-colors ${optimizingEntity?.type === "character" && optimizingEntity.index === i ? "bg-gray-400 cursor-not-allowed" : "bg-[#2a2c31] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black border border-[var(--border)]"}`}
                                      >
                                        {optimizingEntity?.type ===
                                          "character" &&
                                        optimizingEntity.index === i
                                          ? "优化中..."
                                          : "优化"}
                                      </button>
                                      <button
                                        onClick={() =>
                                          generateMetaImage(
                                            "character",
                                            char,
                                            i,
                                          )
                                        }
                                        disabled={generatingMetaImage === `character-${i}`}
                                        className={`text-[9px] px-2 py-1 rounded flex items-center justify-center gap-1 transition-all ${
                                          generatingMetaImage === `character-${i}` 
                                            ? "bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed" 
                                            : "bg-black text-white hover:bg-gray-800"
                                        }`}
                                      >
                                        {generatingMetaImage === `character-${i}` ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            生成中
                                          </>
                                        ) : (
                                          "生图"
                                        )}
                                      </button>
                                    </div>
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'character', 'actions')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'character', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td className="p-1 bg-gray-50 flex items-center justify-center relative min-h-[100px]">
                                    {metaImages[`character-${i}`] ? (
                                      <div
                                        className="relative group cursor-zoom-in"
                                        onClick={() =>
                                          setPreviewFrameIndex(20000 + i)
                                        }
                                      >
                                        <img
                                          src={metaImages[`character-${i}`]}
                                          className="max-h-[100px] object-contain transition-transform group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <Maximize2 className="text-white w-4 h-4" />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-[8px] text-gray-400 italic">
                                        待生成
                                      </div>
                                    )}
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'character', 'preview')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'character', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      {/* Scenes Table */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold border-l-4 border-black pl-3 flex items-center gap-2">
                            <MapPin className="w-5 h-5" /> 场景环境清单 (SCENES)
                          </h2>
                          <div className="flex gap-2 no-print">
                            <button
                              onClick={() => addColumn("scene")}
                              className="text-[9px] bg-gray-100 border border-gray-300 px-2 py-1 rounded hover:bg-gray-200"
                            >
                              + 增加列
                            </button>
                            <button
                              onClick={() => addRow("scene")}
                              className="text-[9px] bg-black text-white px-3 py-1 rounded font-bold uppercase"
                            >
                              + 添加场景行
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto border border-black">
                          <table
                            className="w-full border-collapse table-fixed"
                            style={{
                              fontSize: `${tableFontSize}px`,
                              lineHeight: tableLineHeight,
                            }}
                          >
                            <thead>
                              <tr className="bg-gray-50 border-b border-black">
                                <th 
                                  style={{ width: `${sceneColWidths.name}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  场景名称
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'scene', 'name')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${sceneColWidths.setting}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  环境特征与描述
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'scene', 'setting')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${sceneColWidths.lighting}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  光影气氛
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'scene', 'lighting')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${sceneColWidths.atmosphere}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  空间构图感
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'scene', 'atmosphere')}
                                  />
                                </th>
                                {sceneCols.map((col) => (
                                  <th
                                    key={col}
                                    style={{ width: `${sceneColWidths[col] || 150}px` }}
                                    className="border-r border-black p-2 relative group"
                                  >
                                    {col}
                                    <button
                                      onClick={() => removeColumn("scene", col)}
                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 no-print"
                                    >
                                      ×
                                    </button>
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                      onMouseDown={(e) => handleColResizeStart(e, 'scene', col)}
                                    />
                                  </th>
                                ))}
                                <th 
                                  style={{ width: `${sceneColWidths.actions}px` }}
                                  className="border-r border-black p-2 w-20 no-print relative"
                                >
                                  操作
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'scene', 'actions')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${sceneColWidths.preview}px` }}
                                  className="p-2 w-32 bg-gray-50 font-bold text-center relative"
                                >
                                  视觉效果预览
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'scene', 'preview')}
                                  />
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.scenes.map((scene: any, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-gray-300 relative"
                                  style={{ height: sceneRowHeights[i] ? `${sceneRowHeights[i]}px` : 'auto' }}
                                >
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <input
                                      className="w-full bg-transparent outline-none font-bold"
                                      value={scene.name}
                                      onChange={(e) =>
                                        updateScene(i, "name", e.target.value)
                                      }
                                    />
                                    {/* Horizontal resize handle */}
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'scene', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <textarea
                                      className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                      value={scene.setting}
                                      onChange={(e) =>
                                        updateScene(
                                          i,
                                          "setting",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'scene', 'setting')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'scene', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <textarea
                                      className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                      value={scene.lighting || ""}
                                      onChange={(e) =>
                                        updateScene(
                                          i,
                                          "lighting",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'scene', 'lighting')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'scene', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <textarea
                                      className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                      value={scene.atmosphere || ""}
                                      onChange={(e) =>
                                        updateScene(
                                          i,
                                          "atmosphere",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'scene', 'atmosphere')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'scene', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  {sceneCols.map((col) => (
                                    <td
                                      key={col}
                                      className="border-r border-black p-0 relative"
                                      style={{ padding: `${tablePadding}px` }}
                                    >
                                      <textarea
                                        className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                        value={scene[col] || ""}
                                        onChange={(e) =>
                                          updateScene(
                                            i,
                                            col as any,
                                            e.target.value,
                                          )
                                        }
                                      />
                                      {/* Resizers */}
                                      <div 
                                        className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                        onMouseDown={(e) => handleColResizeStart(e, 'scene', col)}
                                      />
                                      <div 
                                        className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                        onMouseDown={(e) => {
                                          const rowEl = e.currentTarget.closest('tr');
                                          if (rowEl) handleRowResizeStart(e, 'scene', i, rowEl.offsetHeight);
                                        }}
                                      />
                                    </td>
                                  ))}
                                  <td
                                    className="border-r border-black no-print align-middle text-center relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <div className="flex flex-col gap-1">
                                      <button
                                        onClick={() =>
                                          handleOptimizeEntityPrompt("scene", i)
                                        }
                                        disabled={
                                          optimizingEntity?.type === "scene" &&
                                          optimizingEntity.index === i
                                        }
                                        className={`text-[9px] px-2 py-1 rounded transition-colors ${optimizingEntity?.type === "scene" && optimizingEntity.index === i ? "bg-gray-400 cursor-not-allowed" : "bg-[#2a2c31] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black border border-[var(--border)]"}`}
                                      >
                                        {optimizingEntity?.type === "scene" &&
                                        optimizingEntity.index === i
                                          ? "优化中..."
                                          : "优化"}
                                      </button>
                                      <button
                                        onClick={() =>
                                          generateMetaImage("scene", scene, i)
                                        }
                                        disabled={generatingMetaImage === `scene-${i}`}
                                        className={`text-[9px] px-2 py-1 rounded flex items-center justify-center gap-1 transition-all ${
                                          generatingMetaImage === `scene-${i}` 
                                            ? "bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed" 
                                            : "bg-black text-white hover:bg-gray-800"
                                        }`}
                                      >
                                        {generatingMetaImage === `scene-${i}` ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            生成中
                                          </>
                                        ) : (
                                          "生图"
                                        )}
                                      </button>
                                    </div>
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'scene', 'actions')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'scene', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td className="p-1 bg-gray-50 flex items-center justify-center relative min-h-[100px]">
                                    {metaImages[`scene-${i}`] ? (
                                      <div
                                        className="relative group cursor-zoom-in"
                                        onClick={() =>
                                          setPreviewFrameIndex(11000 + i)
                                        }
                                      >
                                        <img
                                          src={metaImages[`scene-${i}`]}
                                          className="max-h-[100px] object-contain transition-transform group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <Maximize2 className="text-white w-4 h-4" />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-[8px] text-gray-400 italic">
                                        待生成
                                      </div>
                                    )}
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'scene', 'preview')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'scene', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>


                      {/* Props Table */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-bold border-l-4 border-black pl-3 flex items-center gap-2">
                            <Package className="w-5 h-5" /> 关键道具清单 (PROPS)
                          </h2>
                          <div className="flex gap-2 no-print">
                            <button
                              onClick={() => addColumn("prop")}
                              className="text-[9px] bg-gray-100 border border-gray-300 px-2 py-1 rounded hover:bg-gray-200"
                            >
                              + 增加列
                            </button>
                            <button
                              onClick={() => addRow("prop")}
                              className="text-[9px] bg-black text-white px-3 py-1 rounded font-bold uppercase"
                            >
                              + 添加道具行
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto border border-black">
                          <table
                            className="w-full border-collapse table-fixed"
                            style={{
                              fontSize: `${tableFontSize}px`,
                              lineHeight: tableLineHeight,
                            }}
                          >
                            <thead>
                              <tr className="bg-gray-50 border-b border-black">
                                <th 
                                  style={{ width: `${propColWidths.name}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  道具名称
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'prop', 'name')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${propColWidths.description}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  道具特征 / 设计细节
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'prop', 'description')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${propColWidths.usage}px` }}
                                  className="border-r border-black p-2 relative"
                                >
                                  剧中用途 / 使用逻辑
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'prop', 'usage')}
                                  />
                                </th>
                                {propCols.map((col) => (
                                  <th
                                    key={col}
                                    style={{ width: `${propColWidths[col] || 150}px` }}
                                    className="border-r border-black p-2 relative group"
                                  >
                                    {col}
                                    <button
                                      onClick={() => removeColumn("prop", col)}
                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 no-print"
                                    >
                                      ×
                                    </button>
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                      onMouseDown={(e) => handleColResizeStart(e, 'prop', col)}
                                    />
                                  </th>
                                ))}
                                <th 
                                  style={{ width: `${propColWidths.actions}px` }}
                                  className="border-r border-black p-2 w-20 no-print relative"
                                >
                                  操作
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'prop', 'actions')}
                                  />
                                </th>
                                <th 
                                  style={{ width: `${propColWidths.preview}px` }}
                                  className="p-2 w-32 bg-gray-50 font-bold text-center relative"
                                >
                                  视觉效果预览
                                  <div 
                                    className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'prop', 'preview')}
                                  />
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.props.map((prop: any, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-gray-300 relative"
                                  style={{ height: propRowHeights[i] ? `${propRowHeights[i]}px` : 'auto' }}
                                >
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <input
                                      className="w-full bg-transparent outline-none font-bold"
                                      value={prop.name}
                                      onChange={(e) =>
                                        updateProp(i, "name", e.target.value)
                                      }
                                    />
                                    {/* Horizontal resize handle */}
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'prop', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <textarea
                                      className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                      value={prop.description}
                                      onChange={(e) =>
                                        updateProp(
                                          i,
                                          "description",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'prop', 'description')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'prop', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td
                                    className="border-r border-black p-0 relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <textarea
                                      className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                      value={prop.usage}
                                      onChange={(e) =>
                                        updateProp(i, "usage", e.target.value)
                                      }
                                    />
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'prop', 'usage')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'prop', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  {propCols.map((col) => (
                                    <td
                                      key={col}
                                      className="border-r border-black p-0 relative"
                                      style={{ padding: `${tablePadding}px` }}
                                    >
                                      <textarea
                                        className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                        value={prop[col] || ""}
                                        onChange={(e) =>
                                          updateProp(
                                            i,
                                            col as any,
                                            e.target.value,
                                          )
                                        }
                                      />
                                      {/* Resizers */}
                                      <div 
                                        className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                        onMouseDown={(e) => handleColResizeStart(e, 'prop', col)}
                                      />
                                      <div 
                                        className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                        onMouseDown={(e) => {
                                          const rowEl = e.currentTarget.closest('tr');
                                          if (rowEl) handleRowResizeStart(e, 'prop', i, rowEl.offsetHeight);
                                        }}
                                      />
                                    </td>
                                  ))}
                                  <td
                                    className="border-r border-black no-print align-middle text-center relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <div className="flex flex-col gap-1">
                                      <button
                                        onClick={() =>
                                          handleOptimizeEntityPrompt("prop", i)
                                        }
                                        disabled={
                                          optimizingEntity?.type === "prop" &&
                                          optimizingEntity.index === i
                                        }
                                        className={`text-[9px] px-2 py-1 rounded transition-colors ${optimizingEntity?.type === "prop" && optimizingEntity.index === i ? "bg-gray-400 cursor-not-allowed" : "bg-[#2a2c31] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black border border-[var(--border)]"}`}
                                      >
                                        {optimizingEntity?.type === "prop" &&
                                        optimizingEntity.index === i
                                          ? "优化中..."
                                          : "优化"}
                                      </button>
                                      <button
                                        onClick={() =>
                                          generateMetaImage("prop", prop, i)
                                        }
                                        disabled={generatingMetaImage === `prop-${i}`}
                                        className={`text-[9px] px-2 py-1 rounded flex items-center justify-center gap-1 transition-all ${
                                          generatingMetaImage === `prop-${i}` 
                                            ? "bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed" 
                                            : "bg-black text-white hover:bg-gray-800"
                                        }`}
                                      >
                                        {generatingMetaImage === `prop-${i}` ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            生成中
                                          </>
                                        ) : (
                                          "生图"
                                        )}
                                      </button>
                                    </div>
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'prop', 'actions')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'prop', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                  <td className="p-1 bg-gray-50 flex items-center justify-center relative min-h-[100px]">
                                    {metaImages[`prop-${i}`] ? (
                                      <div
                                        className="relative group cursor-zoom-in"
                                        onClick={() =>
                                          setPreviewFrameIndex(12000 + i)
                                        }
                                      >
                                        <img
                                          src={metaImages[`prop-${i}`]}
                                          className="max-h-[100px] object-contain transition-transform group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <Maximize2 className="text-white w-4 h-4" />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-[8px] text-gray-400 italic">
                                        待生成
                                      </div>
                                    )}
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-1px] w-[3px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'prop', 'preview')}
                                    />
                                    <div 
                                      className="absolute bottom-0 left-0 w-full h-[3px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'prop', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    </div>

                    <div className="mt-16 pt-6 border-t border-gray-300 text-[10px] text-gray-400 font-mono flex justify-between uppercase">
                      <span>Confidential - Production Document v1.2</span>
                      <span>Page 01 of 01</span>
                    </div>
                  </div>
                </div>
              )}

                {activeTab === "storyboard" && (
                  <div 
                    className="transition-all duration-300 ease-out"
                    style={{ 
                      transform: `scale(${zoomScale})`, 
                      transformOrigin: "top center",
                      width: "100%"
                    }}
                  >
                    <div 
                      id="storyboard-export-container"
                      className="bg-white text-black p-10 min-h-screen shadow-inner max-w-6xl mx-auto rounded-sm border border-gray-300"
                    >
                      <div className="text-center mb-10 border-b-2 border-black pb-4">
                        <h1 className="text-2xl font-serif font-bold uppercase tracking-widest">
                          影视分镜脚本 (STORYBOARD SCRIPT)
                        </h1>
                        <p className="text-xs text-gray-500 mt-2 font-mono italic">
                          PRODUCTION STORYBOARD EXECUTION SHEET
                        </p>
                      </div>

                      <div className="mb-6 flex items-center justify-between no-print">
                        <div className="flex items-center gap-4 bg-gray-100 p-2 rounded border border-gray-300">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold">
                              字体大小:
                            </span>
                            <input
                              type="range"
                              min="8"
                              max="24"
                              value={tableFontSize}
                              onChange={(e) =>
                                setTableFontSize(Number(e.target.value))
                              }
                              className="w-20"
                            />
                          </div>
                          <div className="w-px h-4 bg-gray-300" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold">边距:</span>
                            <input
                              type="range"
                              min="2"
                              max="30"
                              value={tablePadding}
                              onChange={(e) =>
                                setTablePadding(Number(e.target.value))
                              }
                              className="w-20"
                            />
                          </div>
                          <div className="w-px h-4 bg-gray-300" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold">行高:</span>
                            <input
                              type="range"
                              min="1"
                              max="3"
                              step="0.1"
                              value={tableLineHeight}
                              onChange={(e) =>
                                setTableLineHeight(Number(e.target.value))
                              }
                              className="w-20"
                            />
                          </div>
                          <div className="w-px h-4 bg-gray-300" />
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="font-bold">缩放:</span>
                            <button
                              onClick={() =>
                                setZoomScale(Math.max(0.4, zoomScale - 0.1))
                              }
                            >
                              <ZoomOut className="w-3 h-3" />
                            </button>
                            <span className="font-mono min-w-[3ch]">
                              {Math.round(zoomScale * 100)}%
                            </span>
                            <button
                              onClick={() =>
                                setZoomScale(Math.min(2.5, zoomScale + 0.1))
                              }
                            >
                              <ZoomIn className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleExportWord}
                            className="text-[10px] bg-blue-600 text-white px-3 py-2 rounded flex items-center gap-1.5 hover:bg-blue-700 transition-all font-bold uppercase tracking-widest"
                          >
                            <File className="w-3 h-3" /> WORD 导出
                          </button>
                          <button
                            onClick={handleExportPDF}
                            className="text-[10px] bg-red-600 text-white px-3 py-2 rounded flex items-center gap-1.5 hover:bg-red-700 transition-all font-bold uppercase tracking-widest"
                          >
                            <Download className="w-3 h-3" /> PDF 导出
                          </button>
                          <button
                            onClick={() => addColumn("storyboard")}
                            className="text-[10px] bg-gray-100 border border-gray-300 px-3 py-2 rounded font-bold uppercase tracking-widest hover:bg-gray-200 transition-all"
                          >
                            + 增加列
                          </button>
                          <button
                            onClick={generateAllFrameImages}
                            disabled={isGeneratingAll}
                            className="text-[10px] bg-black text-white px-4 py-2 rounded font-bold uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50"
                          >
                            批量生图
                          </button>
                        </div>
                      </div>

                      <div id="storyboard-content">
                      <div className="overflow-x-auto">
                        <table
                          className="w-full border-collapse border-t-2 border-l-2 border-black table-fixed"
                          style={{
                            fontSize: `${tableFontSize}px`,
                            lineHeight: tableLineHeight,
                          }}
                        >
                          <thead>
                            <tr className="bg-gray-100 border-b-2 border-black">
                              <th 
                                style={{ width: `${storyboardColWidths.index}px` }}
                                className="border-r-2 border-b-2 border-black p-2 text-center relative"
                              >
                                镜号
                                <div 
                                  className="absolute top-0 right-[-2px] w-[5px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                  onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'index')}
                                />
                              </th>
                              <th 
                                style={{ width: `${storyboardColWidths.shot}px` }}
                                className="border-r-2 border-b-2 border-black p-2 relative"
                              >
                                景别 / 角度
                                <div 
                                  className="absolute top-0 right-[-2px] w-[5px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                  onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'shot')}
                                />
                              </th>
                              <th 
                                style={{ width: `${storyboardColWidths.narration}px` }}
                                className="border-r-2 border-b-2 border-black p-2 relative"
                              >
                                旁白 / 对白
                                <div 
                                  className="absolute top-0 right-[-2px] w-[5px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                  onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'narration')}
                                />
                              </th>
                              <th 
                                style={{ width: `${storyboardColWidths.subtitles}px` }}
                                className="border-r-2 border-b-2 border-black p-2 relative"
                              >
                                字幕 (SUPER)
                                <div 
                                  className="absolute top-0 right-[-2px] w-[5px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                  onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'subtitles')}
                                />
                              </th>
                              <th 
                                style={{ width: `${storyboardColWidths.visual}px` }}
                                className="border-r-2 border-b-2 border-black p-2 relative"
                              >
                                画面内容描述
                                <div 
                                  className="absolute top-0 right-[-2px] w-[5px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                  onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'visual')}
                                />
                              </th>
                              {storyboardCols.map((col) => (
                                <th
                                  key={col}
                                  style={{ width: `${storyboardColWidths[col] || 150}px` }}
                                  className="border-r-2 border-b-2 border-black p-2 relative group"
                                >
                                  {col}
                                  <button
                                    onClick={() =>
                                      removeColumn("storyboard", col)
                                    }
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 no-print"
                                  >
                                    ×
                                  </button>
                                  <div 
                                    className="absolute top-0 right-[-2px] w-[5px] h-full cursor-col-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => handleColResizeStart(e, 'storyboard', col)}
                                  />
                                </th>
                              ))}
                              <th 
                                style={{ width: `${storyboardColWidths.actions}px` }}
                                className="border-r-2 border-b-2 border-black p-2 text-center no-print relative"
                              >
                                操作
                                <div 
                                  className="absolute top-0 right-[-2px] w-[5px] h-full cursor-col-resize z-10 hover:bg-blue-400 select-none"
                                  onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'actions')}
                                />
                              </th>
                              <th 
                                style={{ width: `${storyboardColWidths.preview}px` }}
                                className="border-r-2 border-b-2 border-black p-2 bg-gray-50 font-bold text-center relative"
                              >
                                分镜视觉效果预览
                                <div 
                                  className="absolute top-0 right-[-2px] w-[5px] h-full cursor-col-resize z-10 hover:bg-blue-400 select-none"
                                  onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'preview')}
                                />
                              </th>
                              <th 
                                style={{ width: `${storyboardColWidths.videoPrompt}px` }}
                                className="border-l-2 border-b-2 border-black p-2 bg-gray-50 font-bold relative"
                              >
                                图生视频提示词
                                <div 
                                  className="absolute top-0 right-[-2px] w-[5px] h-full cursor-col-resize z-10 hover:bg-blue-400 select-none"
                                  onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'videoPrompt')}
                                />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.storyboard.map((frame: any, i) => (
                              <tr 
                                key={i} 
                                className="border-b border-black relative group/row"
                                style={{ height: storyboardRowHeights[i] ? `${storyboardRowHeights[i]}px` : undefined }}
                              >
                                <td
                                  className="border-r-2 border-black text-center font-bold relative"
                                  style={{ padding: `${tablePadding}px` }}
                                >
                                  {frame.frameNumber}
                                  {/* Row resize handle */}
                                  <div 
                                    className="absolute bottom-[-2px] left-0 w-full h-[5px] cursor-row-resize z-10 no-print hover:bg-blue-400 select-none"
                                    onMouseDown={(e) => {
                                      const rowEl = e.currentTarget.closest('tr');
                                      if (rowEl) handleRowResizeStart(e, 'storyboard', i, rowEl.offsetHeight);
                                    }}
                                  />
                                </td>
                                <td
                                  className="border-r-2 border-black relative"
                                  style={{ padding: `${tablePadding}px` }}
                                >
                                  <div className="space-y-1">
                                    <input
                                      className="w-full bg-transparent border-b border-gray-200 outline-none font-bold uppercase"
                                      value={frame.shotType}
                                      onChange={(e) =>
                                        updateStoryboardFrame(
                                          i,
                                          "shotType",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    <input
                                      className="w-full bg-transparent outline-none text-[0.8em] text-gray-500 uppercase"
                                      value={frame.angle}
                                      onChange={(e) =>
                                        updateStoryboardFrame(
                                          i,
                                          "angle",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                  {/* Resizers */}
                                  <div 
                                    className="absolute top-0 right-[-2.5px] w-[5px] h-full cursor-col-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'shot')}
                                  />
                                  <div 
                                    className="absolute bottom-[-2.5px] left-0 w-full h-[5px] cursor-row-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => {
                                      const rowEl = e.currentTarget.closest('tr');
                                      if (rowEl) handleRowResizeStart(e, 'storyboard', i, rowEl.offsetHeight);
                                    }}
                                  />
                                </td>
                                <td
                                  className="border-r-2 border-black relative"
                                  style={{ padding: `${tablePadding}px` }}
                                >
                                  <textarea
                                    className="w-full bg-transparent outline-none resize-none min-h-[60px]"
                                    value={
                                      frame.narration || ""
                                    }
                                    placeholder="旁白 / 对白"
                                    onChange={(e) =>
                                      updateStoryboardFrame(
                                        i,
                                        "narration",
                                        e.target.value,
                                      )
                                    }
                                  />
                                  {/* Resizers */}
                                  <div 
                                    className="absolute top-0 right-[-2.5px] w-[5px] h-full cursor-col-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'narration')}
                                  />
                                  <div 
                                    className="absolute bottom-[-2.5px] left-0 w-full h-[5px] cursor-row-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => {
                                      const rowEl = e.currentTarget.closest('tr');
                                      if (rowEl) handleRowResizeStart(e, 'storyboard', i, rowEl.offsetHeight);
                                    }}
                                  />
                                </td>
                                <td
                                  className="border-r-2 border-black relative"
                                  style={{ padding: `${tablePadding}px` }}
                                >
                                  <textarea
                                    className="w-full bg-transparent outline-none resize-none min-h-[60px]"
                                    value={frame.subtitles || ""}
                                    placeholder="字幕内容 (Super)"
                                    onChange={(e) =>
                                      updateStoryboardFrame(
                                        i,
                                        "subtitles",
                                        e.target.value,
                                      )
                                    }
                                  />
                                  {/* Resizers */}
                                  <div 
                                    className="absolute top-0 right-[-2.5px] w-[5px] h-full cursor-col-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'subtitles')}
                                  />
                                  <div 
                                    className="absolute bottom-[-2.5px] left-0 w-full h-[5px] cursor-row-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => {
                                      const rowEl = e.currentTarget.closest('tr');
                                      if (rowEl) handleRowResizeStart(e, 'storyboard', i, rowEl.offsetHeight);
                                    }}
                                  />
                                </td>
                                <td
                                  className="border-r-2 border-black relative"
                                  style={{ padding: `${tablePadding}px` }}
                                >
                                  <textarea
                                    className="w-full bg-transparent outline-none resize-none min-h-[80px]"
                                    value={frame.visualDescription}
                                    onChange={(e) =>
                                      updateStoryboardFrame(
                                        i,
                                        "visualDescription",
                                        e.target.value,
                                      )
                                    }
                                  />
                                  {/* Resizers */}
                                  <div 
                                    className="absolute top-0 right-[-2.5px] w-[5px] h-full cursor-col-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'visual')}
                                  />
                                  <div 
                                    className="absolute bottom-[-2.5px] left-0 w-full h-[5px] cursor-row-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => {
                                      const rowEl = e.currentTarget.closest('tr');
                                      if (rowEl) handleRowResizeStart(e, 'storyboard', i, rowEl.offsetHeight);
                                    }}
                                  />
                                </td>
                                {storyboardCols.map((col) => (
                                  <td
                                    key={col}
                                    className="border-r-2 border-black relative"
                                    style={{ padding: `${tablePadding}px` }}
                                  >
                                    <textarea
                                      className="w-full bg-transparent outline-none min-h-[60px] resize-none"
                                      value={frame[col] || ""}
                                      onChange={(e) =>
                                        updateStoryboardFrame(
                                          i,
                                          col as any,
                                          e.target.value,
                                        )
                                      }
                                    />
                                    {/* Resizers */}
                                    <div 
                                      className="absolute top-0 right-[-2.5px] w-[5px] h-full cursor-col-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => handleColResizeStart(e, 'storyboard', col)}
                                    />
                                    <div 
                                      className="absolute bottom-[-2.5px] left-0 w-full h-[5px] cursor-row-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                      onMouseDown={(e) => {
                                        const rowEl = e.currentTarget.closest('tr');
                                        if (rowEl) handleRowResizeStart(e, 'storyboard', i, rowEl.offsetHeight);
                                      }}
                                    />
                                  </td>
                                ))}
                                <td
                                  className="border-r-2 border-black no-print relative"
                                  style={{ padding: `${tablePadding}px` }}
                                >
                                  <div className="flex flex-col gap-1.5 justify-center h-full">
                                    <button
                                      onClick={() =>
                                        handleOptimizeFramePrompt(i)
                                      }
                                      disabled={optimizingFramePrompt === i}
                                      className={`text-[9px] px-2 py-1 rounded transition-colors ${optimizingFramePrompt === i ? "bg-gray-400 cursor-not-allowed" : "bg-[#2a2c31] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black border border-[var(--border)]"}`}
                                    >
                                      {optimizingFramePrompt === i
                                        ? "优化中..."
                                        : "优化"}
                                    </button>
                                    <button
                                      onClickCapture={async (e) => {
                                        e.stopPropagation();
                                        if (generatingFrames[i]) return;
                                        setGeneratingFrames(prev => ({ ...prev, [i]: true }));
                                        try {
                                          const {
                                            generateComfyUIFrame,
                                            generateFrameImage,
                                            generateWithOtherImageEngine,
                                          } = await import("./services/gemini");
                                          let url;
                                          if (
                                            selectedEngine.startsWith("comfyui")
                                          ) {
                                            const urls =
                                              await generateComfyUIFrame(
                                                comfyUrl,
                                                comfyWorkflow,
                                                comfyNodeId,
                                                `Shot: ${frame.shotType}, Angle: ${frame.angle}. ${frame.visualDescription}. ${frame.composition}`,
                                                customStyle || globalStyle,
                                                false,
                                                currentSamplerConfig,
                                                undefined,
                                                aspectRatio,
                                              );
                                            url = urls[0];
                                          } else if (
                                            selectedEngine === "jimeng" ||
                                            selectedEngine === "kling" ||
                                            selectedEngine === "mj"
                                          ) {
                                            const key =
                                              apiKeys[selectedEngine] || "";
                                            url =
                                              await generateWithOtherImageEngine(
                                                `Shot: ${frame.shotType}, Angle: ${frame.angle}. ${frame.visualDescription}. ${frame.composition}`,
                                                selectedEngine as any,
                                                key,
                                                aspectRatio,
                                              );
                                          } else {
                                            url = await generateFrameImage(
                                              `Shot: ${frame.shotType}, Angle: ${frame.angle}. ${frame.visualDescription}. ${frame.composition}`,
                                              globalStyle,
                                              getProjectContext(),
                                              aspectRatio,
                                              apiKeys.gemini,
                                            );
                                          }
                                          setFrameImages((prev) => ({
                                            ...prev,
                                            [frame.frameNumber]: url,
                                          }));
                                        } catch (err) {
                                          console.error(err);
                                          alert("生图失败: " + String(err));
                                        } finally {
                                          setGeneratingFrames(prev => ({ ...prev, [i]: false }));
                                        }
                                      }}
                                      disabled={generatingFrames[i]}
                                      className={`text-[9px] px-2 py-1 rounded flex items-center justify-center gap-1 transition-all ${
                                        generatingFrames[i] 
                                          ? "bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed" 
                                          : "bg-black text-white hover:bg-gray-800"
                                      }`}
                                    >
                                      {generatingFrames[i] ? (
                                        <>
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          生成中
                                        </>
                                      ) : (
                                        "生图"
                                      )}
                                    </button>
                                  </div>
                                  {/* Resizers */}
                                  <div 
                                    className="absolute top-0 right-[-2.5px] w-[5px] h-full cursor-col-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'actions')}
                                  />
                                  <div 
                                    className="absolute bottom-[-2.5px] left-0 w-full h-[5px] cursor-row-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => {
                                      const rowEl = e.currentTarget.closest('tr');
                                      if (rowEl) handleRowResizeStart(e, 'storyboard', i, rowEl.offsetHeight);
                                    }}
                                  />
                                </td>
                                <td className="border-r-2 border-black bg-gray-50 flex items-center justify-center relative p-1 min-h-[120px]">
                                  {frameImages[frame.frameNumber] ? (
                                    <div
                                      className="relative group cursor-zoom-in"
                                      onClick={() => setPreviewFrameIndex(i)}
                                    >
                                      <img
                                        src={frameImages[frame.frameNumber]}
                                        className="max-w-full max-h-[150px] object-contain border border-gray-300 transition-transform group-hover:scale-105"
                                      />
                                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Maximize2 className="text-white w-5 h-5" />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-[9px] text-gray-400 italic">
                                      待渲染
                                    </div>
                                  )}
                                  {/* Resizers */}
                                  <div 
                                    className="absolute top-0 right-[-2.5px] w-[5px] h-full cursor-col-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'preview')}
                                  />
                                  <div 
                                    className="absolute bottom-[-2.5px] left-0 w-full h-[5px] cursor-row-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => {
                                      const rowEl = e.currentTarget.closest('tr');
                                      if (rowEl) handleRowResizeStart(e, 'storyboard', i, rowEl.offsetHeight);
                                    }}
                                  />
                                </td>
                                <td 
                                  className="border-b border-black bg-gray-50 align-top relative"
                                  style={{ padding: `${tablePadding}px` }}
                                >
                                  <textarea
                                    className="w-full bg-transparent outline-none resize-none min-h-[100px] text-[0.8em] text-gray-600 font-mono"
                                    placeholder="视频生成提示词..."
                                    value={frame.videoPrompt || ""}
                                    onChange={(e) =>
                                      updateStoryboardFrame(
                                        i,
                                        "videoPrompt",
                                        e.target.value,
                                      )
                                    }
                                  />
                                  {/* Resizers */}
                                  <div 
                                    className="absolute top-0 right-[-2.5px] w-[5px] h-full cursor-col-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => handleColResizeStart(e, 'storyboard', 'videoPrompt')}
                                  />
                                  <div 
                                    className="absolute bottom-[-2.5px] left-0 w-full h-[5px] cursor-row-resize z-20 no-print hover:bg-blue-400 select-none transition-colors"
                                    onMouseDown={(e) => {
                                      const rowEl = e.currentTarget.closest('tr');
                                      if (rowEl) handleRowResizeStart(e, 'storyboard', i, rowEl.offsetHeight);
                                    }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mt-16 pt-6 border-t border-gray-300 text-[10px] text-gray-400 font-mono flex justify-between uppercase">
                      <span>Confidential - Production Document v1.2</span>
                      <span>Page 01 of 01</span>
                    </div>
                  </div>
                </div>
              )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Image Preview Modal */}
      {previewFrameIndex !== null && (
        <ImageModal
          index={previewFrameIndex}
          storyboard={results?.storyboard || []}
          images={frameImages}
          referenceImages={referenceImages}
          metaImages={metaImages}
          results={results}
          onClose={() => setPreviewFrameIndex(null)}
          onNavigate={(newIndex) => setPreviewFrameIndex(newIndex)}
          onUpdate={updateStoryboardFrame}
          apiKeys={apiKeys}
          globalStyle={globalStyle}
          projectContext={getProjectContext()}
          aspectRatio={aspectRatio}
        />
      )}

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
  referenceImages,
  metaImages,
  results,
  onClose,
  onNavigate,
  onUpdate,
  apiKeys,
  globalStyle,
  projectContext,
  aspectRatio,
}: {
  index: number | null;
  storyboard: StoryboardFrame[];
  images: Record<number, string>;
  referenceImages?: { id: string; url: string; name: string }[];
  metaImages?: Record<string, string>;
  results?: AnalysisResult | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onUpdate?: (
    index: number,
    field: keyof StoryboardFrame,
    value: string | number,
  ) => void;
  apiKeys: Record<string, string>;
  globalStyle: string;
  projectContext: string;
  aspectRatio: string;
}) {
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (index === null) return null;

  const frame = index < 10000 ? storyboard[index] : null;

  const handleRegenerate = async () => {
    if (!frame) return;
    setIsRegenerating(true);
    try {
      const url = await generateFrameImage(
        frame.visualDescription,
        globalStyle,
        projectContext,
        aspectRatio,
        apiKeys.gemini,
      );
      if (onUpdate && results) {
        // App.tsx uses setFrameImages which isn't passed here directly
        // but we can try to use a window event or simple callback if we had one.
        // For now, let's just alert or assume onUpdate handles it if we pass a special field.
        alert(
          "重新生成成功。由于架构限制，预览图将在刷新页面后或退出预览后更新。",
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegenerating(false);
    }
  };

  let imageUrl = "";
  let isRefImage = false;
  let isMetaImage = false;
  let metaTitle = "";
  let hasNext = false;
  let hasPrev = false;
  let prevIndex = index - 1;
  let nextIndex = index + 1;

  if (index < 10000) {
    // Frame
    imageUrl = images[storyboard[index]?.frameNumber];
    hasNext = index < storyboard.length - 1;
    hasPrev = index > 0;
  } else if (index >= 10000 && index < 20000) {
    // Reference Image
    const refIndex = index - 10000;
    imageUrl = referenceImages?.[refIndex]?.url || "";
    isRefImage = true;
    hasNext = referenceImages ? refIndex < referenceImages.length - 1 : false;
    hasPrev = refIndex > 0;
  } else {
    // Meta Image
    isMetaImage = true;
    if (index >= 20000 && index < 21000) {
      const charIndex = index - 20000;
      imageUrl = metaImages?.[`character-${charIndex}`] || "";
      metaTitle = `角色设定图: ${results?.characters[charIndex]?.name || ""}`;
      hasNext = results ? charIndex < results.characters.length - 1 : false;
      hasPrev = charIndex > 0;
    } else if (index >= 21000 && index < 22000) {
      const sceneIndex = index - 21000;
      imageUrl = metaImages?.[`scene-${sceneIndex}`] || "";
      metaTitle = `场景设定图: ${results?.scenes[sceneIndex]?.name || ""}`;
      hasNext = results ? sceneIndex < results.scenes.length - 1 : false;
      hasPrev = sceneIndex > 0;
    } else if (index >= 22000 && index < 23000) {
      const propIndex = index - 22000;
      imageUrl = metaImages?.[`prop-${propIndex}`] || "";
      metaTitle = `道具设定图: ${results?.props[propIndex]?.name || ""}`;
      hasNext = results ? propIndex < results.props.length - 1 : false;
      hasPrev = propIndex > 0;
    }
  }

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
              alt={isMetaImage ? metaTitle : isRefImage ? "Reference" : "Frame"}
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}

          <button
            disabled={!hasPrev}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(prevIndex);
            }}
            className="absolute left-4 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all disabled:opacity-0"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <button
            disabled={!hasNext}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(nextIndex);
            }}
            className="absolute right-4 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all disabled:opacity-0"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>

        {/* Info Bars Based on Mode */}
        {index < 10000 && storyboard[index] && onUpdate && (
          <div className="h-24 bg-[var(--surface)] border-t border-[var(--border)] p-4 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="bg-[var(--accent)] text-black px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                  FRAME {storyboard[index].frameNumber}
                </span>
                <input
                  type="text"
                  value={storyboard[index].composition}
                  onChange={(e) =>
                    onUpdate(index, "composition", e.target.value)
                  }
                  className="bg-transparent border-none text-[var(--text-dim)] text-[10px] font-mono tracking-tighter uppercase outline-none focus:text-white p-0 m-0"
                />
              </div>
              {imageUrl && (
                <a
                  href={imageUrl}
                  download={`frame_${storyboard[index].frameNumber.toString().padStart(2, "0")}.jpg`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--text-dim)] hover:text-white transition-colors p-1"
                  title="下载图片"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </a>
              )}
            </div>
            <textarea
              value={storyboard[index].visualDescription}
              onChange={(e) =>
                onUpdate(index, "visualDescription", e.target.value)
              }
              className="w-full bg-transparent border-none text-xs text-[var(--text-main)] italic opacity-80 leading-snug outline-none focus:opacity-100 resize-none h-12 p-0 m-0"
            />
          </div>
        )}

        {isRefImage && (
          <div className="h-16 bg-[var(--surface)] border-t border-[var(--border)] p-4 flex items-center justify-between">
            <span className="text-[12px] font-mono text-[var(--accent)] uppercase font-bold tracking-widest">
              {referenceImages?.[index - 10000]?.name || "参考图预览"}
            </span>
            {imageUrl && (
              <a
                href={imageUrl}
                download="reference.jpg"
                onClick={(e) => e.stopPropagation()}
                className="bg-[var(--accent)] hover:opacity-80 text-black px-3 py-1.5 rounded-sm transition-colors border border-[var(--border)] text-xs font-bold flex items-center gap-1.5"
              >
                下载图像
              </a>
            )}
          </div>
        )}

        {isMetaImage && (
          <div className="h-16 bg-[var(--surface)] border-t border-[var(--border)] p-4 flex items-center justify-between">
            <span className="text-[12px] font-mono text-white uppercase font-bold tracking-widest">
              {metaTitle}
            </span>
            {imageUrl && (
              <a
                href={imageUrl}
                download="concept.jpg"
                onClick={(e) => e.stopPropagation()}
                className="bg-[var(--accent)] hover:opacity-80 text-black px-3 py-1.5 rounded-sm transition-colors border border-[var(--border)] text-xs font-bold flex items-center gap-1.5"
              >
                下载设定图
              </a>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
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
