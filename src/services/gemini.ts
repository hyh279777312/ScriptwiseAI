import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Character {
  name: string;
  description: string;
  clothing: string;
  makeup: string;
}

export interface Scene {
  name: string;
  setting: string;
  lighting: string;
  atmosphere: string;
}

export interface Prop {
  name: string;
  description: string;
  usage: string;
}

export interface ReferenceImage {
  id: string;
  url: string;
  name: string;
}

export interface StoryboardFrame {
  frameNumber: number;
  visualDescription: string;
  audioVoiceover: string;
  composition: string;
}

export interface AnalysisResult {
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  storyboard: StoryboardFrame[];
}

// Analysis: Gemini 3.1 Pro Preview (Member Quota)
// Image Generation: Nano Banana series (2.5 Regular / 3.1 High Quality)

export async function analyzeScript(script: string, referenceImages?: string[], customApiKey?: string): Promise<AnalysisResult> {
  const model = "gemini-3.1-pro-preview"; // Using the best available Pro model for analysis
  const currentAi = customApiKey ? new GoogleGenAI({ apiKey: customApiKey }) : ai;
  
  const contentParts: any[] = [
    { text: `
      你是一位专业的导演和分镜师。
      请分析以下故事梗概/剧本，提取角色、场景、道具，并生成一个专业的分镜矩阵。
      
      特别指令：
      1. 所有的输出内容必须使用【中文】。
      2. 不要 1:1 地将一句 VO 映射到一个画面。
      3. 将故事细分为更细致的节奏：包括关键帧 (Keyframes) 和过渡帧 (Transition frames)。
      4. 电影感节奏：使用多样的构图（特写、全景、过肩、倾斜镜头、第一人称视角等）。
      5. 视觉一致性：根据你自己提取的元数据，极其详尽地描述角色和道具。
      6. 动态数量：根据画面视觉复杂度决定分镜数量，而不是根据句子数量。 
      
      剧本内容：${script}
    `.trim() }
  ];

  if (referenceImages && referenceImages.length > 0) {
    referenceImages.forEach((img, index) => {
      contentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: img.split(",")[1],
        },
      });
    });
  }

  const callModel = async (modelName: string) => {
    return await currentAi.models.generateContent({
      model: modelName,
      contents: { parts: contentParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  clothing: { type: Type.STRING },
                  makeup: { type: Type.STRING },
                },
                required: ["name", "description", "clothing", "makeup"],
              },
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  setting: { type: Type.STRING },
                  lighting: { type: Type.STRING },
                  atmosphere: { type: Type.STRING },
                },
                required: ["name", "setting", "lighting", "atmosphere"],
              },
            },
            props: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  usage: { type: Type.STRING },
                },
                required: ["name", "description", "usage"],
              },
            },
            storyboard: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  frameNumber: { type: Type.INTEGER },
                  visualDescription: { type: Type.STRING },
                  audioVoiceover: { type: Type.STRING },
                  composition: { type: Type.STRING },
                },
                required: ["frameNumber", "visualDescription", "audioVoiceover", "composition"],
              },
            },
          },
          required: ["characters", "scenes", "props", "storyboard"],
        },
      },
    });
  };

  let response;
  try {
    response = await callModel(model);
  } catch (error: any) {
    const errorStr = JSON.stringify(error) + String(error);
    if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED")) {
      console.warn("Gemini 3.1 Pro quota exhausted. Falling back to Gemini 2.5 Flash...");
      response = await callModel("gemini-2.5-flash"); // Fallback to a model with higher free tier
    } else {
      throw error;
    }
  }

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(response.text) as AnalysisResult;
}

// Deduplicated analyzeComfyUIScript removed here

export async function analyzeOllamaScript(
  baseUrl: string,
  modelName: string,
  script: string
): Promise<{ text: string, parsed: AnalysisResult | null }> {
  try {
    const prompt = `
你是一位专业的导演和分镜师。
请分析以下故事梗概/剧本，提取角色、场景、道具，并生成一个专业的分镜矩阵。

特别指令：
1. 所有的输出内容必须使用【中文】。
2. 不要 1:1 地将一句 VO 映射到一个画面，要细分节奏使用多样的电影构图。
3. 视觉一致性：根据你自己提取的元数据，极其详尽地描述角色和道具。
4. 【重要】你的输出必须且只能为纯粹的JSON（不要用Markdown格式），完全匹配以下结构：
{
  "characters": [{ "name": "...", "description": "...", "clothing": "...", "makeup": "..." }],
  "props": [{ "name": "...", "description": "...", "usage": "..." }],
  "scenes": [{ "name": "...", "setting": "...", "lighting": "...", "atmosphere": "..." }],
  "storyboard": [{ "frameNumber": 1, "visualDescription": "...", "audioVoiceover": "...", "composition": "..." }]
}

剧本内容：
${script}
`.trim();

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama 错误: ${response.statusText}`);
    }

    const result = await response.json();
    const resultText = result.response;

    if (resultText && typeof resultText === "string") {
      try {
        const match = resultText.match(/\{[\s\S]*\}/);
        const jsonStr = match ? match[0] : resultText;
        const parsed = JSON.parse(jsonStr) as AnalysisResult;
        return { text: resultText, parsed };
      } catch (parseError) {
        // Return raw text if JSON parsing fails
        return { text: resultText, parsed: null };
      }
    } else {
      throw new Error("Ollama 返回数据格式异常，无法提取文本。");
    }
  } catch (err: any) {
    throw new Error(`本地 Ollama 调用失败: ${err.message || '未知错误'}`);
  }
}

export async function generateComfyUIFrame(
  baseUrl: string,
  workflowStr: string,
  promptNodeId: string,
  description: string,
  globalStyle?: string,
  isBatchMode: boolean = false,
  samplerConfig?: { promptWeight?: string, samplerName?: string, steps?: string }
): Promise<string[]> {
  const workflow = JSON.parse(workflowStr);
  let fullPrompt = globalStyle ? `${description}, ${globalStyle}` : description;

  if (!isBatchMode) {
    // Strip line breaks for single generations to prevent string splitters from batching
    fullPrompt = fullPrompt.replace(/\r\n|\n|\r/g, ', ');
  }

  // Auto-traverse to find the root text provision node if the provided node relies on links
  let targetNodeId = String(promptNodeId);
  let maxDepth = 5;
  while (maxDepth > 0) {
    const inputs = workflow[targetNodeId]?.inputs;
    if (!inputs) break;
    
    let foundLink = false;
    const textKeys = ['text', 'prompt', 'string', 'prompt_strings', 'text_b', 'text_g', 'text_l', 'positive', 'cond', 'conditioning', 'value'];
    for (const key of textKeys) {
      if (Array.isArray(inputs[key])) { 
        targetNodeId = String(inputs[key][0]);
        foundLink = true;
        break;
      }
    }
    if (!foundLink) break;
    maxDepth--;
  }

  if (workflow[targetNodeId] && workflow[targetNodeId].inputs) {
    const inputs = workflow[targetNodeId].inputs;
    if (inputs.text !== undefined && !Array.isArray(inputs.text)) inputs.text = fullPrompt;
    else if (inputs.prompt !== undefined && !Array.isArray(inputs.prompt)) inputs.prompt = fullPrompt;
    else if (inputs.string !== undefined && !Array.isArray(inputs.string)) inputs.string = fullPrompt;
    else if (inputs.prompt_strings !== undefined && !Array.isArray(inputs.prompt_strings)) inputs.prompt_strings = fullPrompt;
    else if (inputs.text_b !== undefined && !Array.isArray(inputs.text_b)) inputs.text_b = fullPrompt;
    else if (inputs.value !== undefined && typeof inputs.value === 'string') inputs.value = fullPrompt;
    else {
      // Fallback: scan all nodes to find a CLIPTextEncode or similar text provider
      let foundAlternative = false;
      for (const key in workflow) {
        if (workflow[key]?.class_type?.includes('CLIPTextEncode')) {
          const altInputs = workflow[key].inputs;
          if (altInputs && altInputs.text !== undefined && !Array.isArray(altInputs.text)) {
            altInputs.text = fullPrompt;
            foundAlternative = true;
            break;
          }
        }
      }
      if (!foundAlternative) {
         // Deep fallback on original target string key (could be filename_prefix, but risky)
         const stringKey = Object.keys(inputs).find(k => typeof inputs[k] === 'string' && k !== 'filename_prefix');
         if (stringKey) inputs[stringKey] = fullPrompt;
         else inputs.text = fullPrompt;
      }
    }
  } else {
    throw new Error(`找不到对应的 Prompt Node ID: ${targetNodeId}，请检查 JSON`);
  }

  // Check random seed and override outputs length
  for (const key in workflow) {
    const node = workflow[key];
    if (!node || !node.inputs) continue;
    
    if (node.class_type && node.class_type.includes("Sampler")) {
      if (node.inputs.seed !== undefined) node.inputs.seed = Math.floor(Math.random() * 1000000000000000);
      if (node.inputs.noise_seed !== undefined) node.inputs.noise_seed = Math.floor(Math.random() * 1000000000000000);
      
      if (samplerConfig) {
        if (samplerConfig.promptWeight) {
          const cfgValue = parseFloat(samplerConfig.promptWeight);
          if (!isNaN(cfgValue)) node.inputs.cfg = cfgValue;
        }
        if (samplerConfig.steps) {
          const stepsValue = parseInt(samplerConfig.steps, 10);
          if (!isNaN(stepsValue)) node.inputs.steps = stepsValue;
        }
        if (samplerConfig.samplerName) {
          node.inputs.sampler_name = samplerConfig.samplerName;
        }
      }
    }
    
    // Force batch size to 1 if we are explicitly asking for a single image, 
    // to prevent workflows with hardcoded batch sizes from wasting iterations
    if (!isBatchMode && node.inputs.batch_size !== undefined && !Array.isArray(node.inputs.batch_size)) {
      node.inputs.batch_size = 1;
    }
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow })
  });
  
  if (!res.ok) {
     throw new Error(`ComfyUI 错误: ${res.statusText}`);
  }
  
  const { prompt_id } = await res.json();

  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const histRes = await fetch(`${baseUrl.replace(/\/$/, '')}/history/${prompt_id}`);
      if (!histRes.ok) continue;
      const histData = await histRes.json();
      
      if (histData[prompt_id]) {
        const outputs = histData[prompt_id].outputs;
        const images: string[] = [];
        
        // Collect ALL images from ALL nodes in this generation cycle
        for (const nodeId in outputs) {
          if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
            outputs[nodeId].images.forEach((img: any) => {
              images.push(`${baseUrl.replace(/\/$/, '')}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type}`);
            });
          }
        }
        
        if (images.length > 0) {
          return images;
        } else {
          throw new Error("ComfyUI 执行完成，但没有提取到任何图像输出。请检查工作流中是否包含 SaveImage 节点。");
        }
      }
    } catch(e) {
       console.error("Polling ComfyUI failed", e);
    }
  }
}

export async function generateFrameImage(
  description: string, 
  isHighQuality: boolean = false,
  globalStyle?: string,
  projectContext?: string,
  aspectRatio: string = "16:9",
  customApiKey?: string
): Promise<string> {
  const currentAi = customApiKey ? new GoogleGenAI({ apiKey: customApiKey }) : ai;
  // 指定使用最新的 Flash 生图系列 (2.5 / 3.1 预览版)
  const model = isHighQuality ? "gemini-3.1-flash-image-preview" : "gemini-2.5-flash-image";
  
  const prompt = `
    视觉创作指令 (Visual Directive):
    1. 风格总控 (Style): ${globalStyle || "Cinematic Movie, highly detailed concept art"}
    2. 项目一致性约束 (Consistency): ${projectContext || "Default cinematic settings"}
    3. 当前分镜描述 (Target): ${description}
    
    生成指令：请根据“项目一致性约束”中提到的角色和场景设定，结合“分镜描述”中的动作，以“风格总控”定义的艺术风格生成一张高质量图片。
  `.trim();
  
  const response = await currentAi.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        ...(isHighQuality ? { imageSize: "1K" } : {}) // 1K resolution for HQ mode
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Image generation failed");
}

export async function generateGridImage(
  frames: { number: number, description: string }[],
  isHighQuality: boolean = false,
  globalStyle?: string,
  projectContext?: string,
  aspectRatio: string = "16:9",
  customApiKey?: string
): Promise<string> {
  const currentAi = customApiKey ? new GoogleGenAI({ apiKey: customApiKey }) : ai;
  const model = isHighQuality ? "gemini-3.1-flash-image-preview" : "gemini-2.5-flash-image";
  
  const framesText = frames.map(f => `格 ${f.number}: ${f.description}`).join('\n');
  
  const prompt = `
    视觉创作指令 (Visual Directive):
    1. 风格总控 (Style): Professional Comic Book Template or Storyboard Grid, exactly 3x3 layout, ${globalStyle || "Cinematic Movie, highly detailed concept art"}
    2. 项目一致性约束及资产分析表 (Consistency & Assets): ${projectContext || "Default cinematic settings"}
    3. 九宫格各面版画面细节 (Panel Actions):
    ${framesText}
    
    专属生成指令：这是一张“九宫格分镜整合图”的请求。你必须且只能生成一张**单独的图片**。这张图片内部必须自带纵横分割线，精确布局成横排3列、竖排3行的九宫格(3x3)样式。
    在每个格子里，请【严格结合“项目一致性约束及资产分析表”中定义的人物外貌特征、服装、关键道具以及场景环境设定】，从左到右、从上到下按顺序绘制上述提到的9个剧情独立画面。确保九张分图中的人物和场景资产具备完全的一致性！
  `.trim();

  const response = await currentAi.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        ...(isHighQuality ? { imageSize: "4K" } : {}) 
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Grid image generation failed");
}
