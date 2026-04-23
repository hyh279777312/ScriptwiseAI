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
  shotType?: string;      // 景别
  angle?: string;         // 角度
  narration?: string;    // 旁白/对白
  subtitles?: string;    // 字幕 (Super)
  videoPrompt?: string;  // 图生视频提示词
  cameraMovement?: string; // 镜头动作
}

export interface AnalysisResult {
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  storyboard: StoryboardFrame[];
}

/**
 * 优化实体（角色、场景、道具）提示词
 */
export async function optimizeEntityPrompt(
  type: 'character' | 'scene' | 'prop',
  data: any,
  context: string,
  engine: string = "gemini",
  apiKey?: string,
  ollamaConfig?: { url: string, model: string }
): Promise<any> {
  let entityTask = "";
  let jsonStructure = "";

  if (type === 'character') {
    entityTask = `针对角色进行一键整行扩写优化：性格描述、服装设定、妆造设定。请务必根据该角色的姓名和现有描述，对其所有相关设定进行整体的细节扩充和润色。`;
    jsonStructure = `{ "description": "扩写后的性格描述...", "clothing": "扩写后的服装细节...", "makeup": "扩写后的妆造设定..." }`;
  } else if (type === 'scene') {
    entityTask = `针对场景进行一键整行扩写优化：环境特征、光影氛围、空间构图感。请务必根据该场景的名称和现有设定，对其进行整体的空间感和氛围感扩充。`;
    jsonStructure = `{ "setting": "扩写后的环境特征...", "lighting": "更专业的灯光设定...", "atmosphere": "更具色彩科学的空间氛围..." }`;
  } else if (type === 'prop') {
    entityTask = `针对道具进行一键整行扩写优化：道具特征/设计细节、使用逻辑。请针对该道具的外观、材质、及在剧本中的使用细节进行扩写。`;
    jsonStructure = `{ "description": "扩写后的细节设计描述...", "usage": "扩写后的交互与逻辑描述..." }`;
  }

  const prompt = `
    你是一位电影视觉大师和顶级提示词工程师。
    请根据提供的【现有数据】和【剧本逻辑上下文】，${entityTask}
    
    优化要求：
    1. 增强细节：加入具体的质感、材质、色彩氛围、以及符合电影感的细节描述。
    2. 逻辑一致：确保优化后的内容与剧本上下文逻辑自洽。
    3. 【重要要求】：你的输出必须且只能为纯粹的JSON（不要用Markdown格式），完全匹配以下结构：
    ${jsonStructure}
    
    【现有数据】：${JSON.stringify(data)}
    【剧本上下文】：${context}
  `.trim();

  try {
    let resultText = "";
    if (engine === "gemini") {
      const currentAi = apiKey ? new GoogleGenAI({ apiKey: apiKey }) : ai;
      const model = "gemini-3.1-pro";
      const response = await currentAi.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
      });
      resultText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } else if (engine === "ollama") {
      const baseUrl = ollamaConfig?.url || "http://127.0.0.1:11434";
      const modelName = ollamaConfig?.model || "qwen3-coder:30b";
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName, prompt: prompt, stream: false }),
      });
      if (!response.ok) throw new Error(`Ollama 优化失败: ${response.statusText}`);
      const result = await response.json();
      resultText = result.response?.trim() || "";
    } else {
      const modelMap: Record<string, string> = { gpt: "gpt-4o", doubao: "doubao-pro-128k" };
      const endpointMap: Record<string, string> = {
        gpt: "https://api.openai.com/v1/chat/completions",
        doubao: "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
      };
      const endpoint = endpointMap[engine] || endpointMap["gpt"];
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelMap[engine] || engine,
          messages: [{ role: "system", content: "你是一位电影视觉大师，擅长网页提示词优化。" }, { role: "user", content: prompt }]
        })
      });
      if (!res.ok) throw new Error(`${engine} 优化请求失败: ${res.statusText}`);
      const resData = await res.json();
      resultText = resData.choices?.[0]?.message?.content?.trim() || "";
    }

    const match = resultText.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : resultText;
    return JSON.parse(jsonStr);
  } catch (err: any) {
    console.error(`Entity optimization failed`, err);
    throw err;
  }
}

/**
 * 优化分镜视觉描述提示词
 */
export async function optimizeStoryboardPrompt(
  visualDescription: string,
  context: string,
  engine: string = "gemini",
  apiKey?: string,
  ollamaConfig?: { url: string, model: string }
): Promise<string> {
  const prompt = `
    你是一位电影视觉大师和顶级提示词工程师。
    请根据提供的【视觉描述】和【剧本逻辑上下文】，将其扩写并优化为一段更具画面感、细节丰富、且符合电影工业标准的生图提示词。
    
    优化要求：
    1. 增强细节：加入具体的构图、景深、光影效果（如丁达尔效应、冷暖对冲等）、材质细节、色彩氛围。
    2. 明确构图：在提示词中强调镜头语言（如：俯瞰全景、极简构图、对称构图等）。
    3. 风格对齐：确保优化后的描述能产生极具视觉冲击力的图像。
    4. 简洁高效：描述应精准、有力。
    5. 【语言要求】：请直接输出优化后的【中文描述内容】，不要包含任何解释、引号或前缀。
    
    【原始描述】：${visualDescription}
    【剧本上下文】：${context}
  `.trim();

  try {
    if (engine === "gemini") {
      const currentAi = apiKey ? new GoogleGenAI({ apiKey: apiKey }) : ai;
      const model = "gemini-3.1-pro";
      const response = await currentAi.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || visualDescription;
    } else if (engine === "ollama") {
      const baseUrl = ollamaConfig?.url || "http://127.0.0.1:11434";
      const modelName = ollamaConfig?.model || "qwen3-coder:30b";
      
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`Ollama 优化失败: ${response.statusText}`);
      const result = await response.json();
      return result.response?.trim() || visualDescription;
    } else {
      // For GPT, Doubao or other LLMs
      const modelMap: Record<string, string> = {
        gpt: "gpt-4o",
        doubao: "doubao-pro-128k"
      };
      const endpointMap: Record<string, string> = {
        gpt: "https://api.openai.com/v1/chat/completions",
        doubao: "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
      };

      const endpoint = endpointMap[engine] || endpointMap["gpt"];
      const model = modelMap[engine] || engine;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "system", content: "你是一位电影视觉大师，擅长网页提示词优化。" }, { role: "user", content: prompt }]
        })
      });

      if (!res.ok) throw new Error(`${engine} 优化请求失败: ${res.statusText}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || visualDescription;
    }
  } catch (err: any) {
    console.error(`${engine} prompt optimization failed`, err);
    throw err; // Re-throw to allow UI to show error alert
  }
}

export async function analyzeScript(script: string, referenceImages?: string[], customApiKey?: string): Promise<AnalysisResult> {
  const model = "gemini-3.1-pro"; // Using the best available Pro model for analysis
  const currentAi = customApiKey ? new GoogleGenAI({ apiKey: customApiKey }) : ai;
  
  const contentParts: any[] = [
    { text: `
      你是一位专业的导演和分镜师。
      请分析以下故事梗概/剧本，提取角色、场景、道具，并生成一个专业的分镜矩阵。
      
      特别指令：
      1. 所有的输出内容必须使用【中文】。
      2. 不要 1:1 地将一句 VO 映射到一个画面。
      3. 【重要】如果一段描述中出现了不同的场景/地点，必须强制拆分为不同的分镜帧。一个分镜提示词内不得出现两个及以上场景的描述。
      4. 电影感节奏：使用多样的构图（特写、全景、过肩、倾斜镜头、第一人称视角等）。
      5. 视觉一致性：分析结果中角色、场景、道具等全局性提示词必须智能划分并写入到相应分镜的视觉描述 (visualDescription) 中，以确保一致性。
      6. 【重要格式】：每一帧的分镜视觉描述（visualDescription）开头必须智能添加【景别、镜头、画面风格】，并用逗号隔开。此要求严禁省略。
      7. 【新增字段】：为每个分镜提取出纯粹的景别 (shotType, 如特写/全景) 和镜头运动 (cameraMovement, 如摇镜头/固定)。
      8. 【声音与字幕】：将剧本中的 VO、旁白、对白内容准确识别并填入 narration 字段。将剧本中出现的 Super、花字、字幕内容准确识别并填入 subtitles 字段。【严格要求】：如果剧本中在当前分镜没有对应的旁白或字幕内容，请在该字段中返回空字符串 ""，绝对不要把画面视觉描述填充到旁白或字幕列中。
      9. 【视频提示词】：根据视觉描述，生成一段专业的“图生视频提示词”(videoPrompt)，描述画面中的动态趋势、镜头轨迹或微表情变化。
      10. 动态数量：根据画面视觉复杂度决定分镜数量。      
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
                  shotType: { type: Type.STRING },
                  cameraMovement: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  subtitles: { type: Type.STRING },
                  videoPrompt: { type: Type.STRING },
                },
                required: ["frameNumber", "visualDescription", "audioVoiceover", "composition", "shotType", "cameraMovement", "narration", "subtitles", "videoPrompt"],
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
3. 【强制拆分场景】：如果一段描述中出现了不同的场景或地点，必须将其拆分为对应的多个分镜帧。一个分镜提示词内【绝对不得】出现两个及以上场景的描述。
4. 视觉一致性：分析结果中角色、场景、道具等全局性提示词必须智能划分并写入到相应分镜的视觉描述 (visualDescription) 中，以确保一致性。
5. 【重要格式】：每一帧的分镜视觉描述（visualDescription）开头必须智能添加【景别、镜头、画面风格】，并用逗号隔开。此要求严禁省略。
6. 【声音与字幕】：将剧本中的 VO、旁白、对白内容准确识别并填入 narration 字段。将剧本中出现的 Super、花字、字幕内容准确识别并填入 subtitles 字段。【严格要求】：如果该分镜没有对应的声音或字幕内容，请保持该字段为空字符串 ""，不得填充任何视觉描述。
7. 【视频提示词】：根据视觉描述，生成一段专业的“图生视频提示词”(videoPrompt)，描述画面中的动态趋势、镜头轨迹或微表情变化。
8. 【重要】你的输出必须且只能为纯粹的JSON（不要用Markdown格式），完全匹配以下结构：
{
  "characters": [{ "name": "...", "description": "...", "clothing": "...", "makeup": "..." }],
  "props": [{ "name": "...", "description": "...", "usage": "..." }],
  "scenes": [{ "name": "...", "setting": "...", "lighting": "...", "atmosphere": "...", "shotType": "...", "cameraMovement": "..." }],
  "storyboard": [{ "frameNumber": 1, "visualDescription": "...", "audioVoiceover": "...", "composition": "...", "shotType": "...", "cameraMovement": "...", "narration": "...", "subtitles": "...", "videoPrompt": "..." }]
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
  samplerConfig?: { promptWeight?: string, samplerName?: string, steps?: string },
  referenceImages?: { id: string, url: string, name: string }[],
  aspectRatio: string = "16:9"
): Promise<string[]> {
  const workflow = JSON.parse(workflowStr);
  let fullPrompt = globalStyle ? `${description}, ${globalStyle}` : description;

  if (!isBatchMode) {
    // Strip line breaks for single generations to prevent string splitters from batching
    fullPrompt = fullPrompt.replace(/\r\n|\n|\r/g, ', ');
  }

  // Inject Aspect Ratio resolution logic
  const resolutionsMap: Record<string, { w: number, h: number }> = {
    "1:1": { w: 1024, h: 1024 },
    "16:9": { w: 1344, h: 768 },
    "9:16": { w: 768, h: 1344 },
    "4:3": { w: 1152, h: 896 },
    "3:4": { w: 896, h: 1152 },
    "21:9": { w: 1536, h: 640 },
  };
  const size = resolutionsMap[aspectRatio] || { w: 1344, h: 768 };

  // Find all EmptyLatentImage nodes and inject correct widths/heights
  for (const key in workflow) {
    const node = workflow[key];
    if (node?.class_type === "EmptyLatentImage" || node?.class_type === "SDXLEmptyLatentImage") {
      if (node.inputs) {
        if (node.inputs.width !== undefined) node.inputs.width = size.w;
        if (node.inputs.height !== undefined) node.inputs.height = size.h;
      }
    }
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

  // Handle uploading and replacing Reference Images for I2I workflows
  if (referenceImages && referenceImages.length > 0) {
    const uploadedNames: string[] = [];
    
    // 1. Upload images
    for (let i = 0; i < referenceImages.length; i++) {
        const img = referenceImages[i];
        if (!img.url.startsWith("data:image")) continue; // Only handle base64 for reliable uploads
        
        try {
            const blob = await (await fetch(img.url)).blob();
            const formData = new FormData();
            formData.append("image", blob, `ref_${Date.now()}_${i}.png`);
            
            const uploadRes = await fetch(`${baseUrl.replace(/\/$/, '')}/upload/image`, {
                method: "POST",
                body: formData
            });
            if (uploadRes.ok) {
                const { name } = await uploadRes.json();
                if (name) uploadedNames.push(name);
            }
        } catch (e) {
            console.error("Failed to upload reference image to ComfyUI", e);
        }
    }
    
    // 2. Map uploaded names to LoadImage nodes, prioritizing LoadImage class
    if (uploadedNames.length > 0) {
        let nameIdx = 0;
        for (const key in workflow) {
            const node = workflow[key];
            if (node?.class_type === "LoadImage" && node.inputs && node.inputs.image !== undefined) {
                node.inputs.image = uploadedNames[nameIdx % uploadedNames.length];
                nameIdx++;
            }
        }
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

/**
 * 使用其他 LLM (GPT, Doubao 等) 进行剧本分析
 */
export async function analyzeScriptWithOtherLLM(
  script: string, 
  engine: "gpt" | "doubao",
  apiKey: string
): Promise<AnalysisResult> {
  const prompt = `
    你是一位专业的导演和分镜师。
    请分析以下故事梗概/剧本，提取角色、场景、道具，并生成一个专业的分镜矩阵。
    
    特别指令：
    1. 所有的输出内容必须使用【中文】。
    2. 【重要格式】：输出必须为纯粹的 JSON 格式，包含 characters, scenes, props, storyboard 四个数组。
    3. storyboard 中每一帧视觉描述（visualDescription）开头必须包含景别、镜头、画面风格。
    4. 【声音与字幕】：将剧本中的 VO、旁白、对白内容准确识别并填入 narration 字段。将剧本中出现的 Super、花字、字幕内容准确识别并填入 subtitles 字段。【严格要求】：若无对应内容请保持对应字段为空 ""，切勿将画面视觉描述填入。
    5. 【视频提示词】：根据视觉描述，为每一帧生成一段专业的“图生视频提示词”(videoPrompt)，描述画面中的动态趋势（如：镜头缓慢推近、烟雾缭绕、人物眨眼等）。
    
    剧本内容：${script}
    
    请严格返回符合以下结构的 JSON 字符串 (不要包含 md 代码块标识):
    {
      "characters": [],
      "scenes": [],
      "props": [],
      "storyboard": [
        {
          "frameNumber": 1,
          "visualDescription": "...",
          "audioVoiceover": "...",
          "composition": "...",
          "shotType": "...",
          "cameraMovement": "...",
          "narration": "...",
          "subtitles": "...",
          "videoPrompt": "..."
        }
      ]
    }
  `.trim();

  // 映射模型名称
  const modelMap = {
    gpt: "gpt-4o",
    doubao: "doubao-pro-128k"
  };

  // 映射控制台 API 端点 (此处为示意，实际根据具体服务商调整)
  const endpointMap = {
    gpt: "https://api.openai.com/v1/chat/completions",
    doubao: "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
  };

  try {
    const res = await fetch(endpointMap[engine], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelMap[engine],
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) throw new Error(`${engine} API 调用失败: ${res.statusText}`);
    const data = await res.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content) as AnalysisResult;
  } catch (err) {
    console.error(`${engine} analysis failed`, err);
    throw err;
  }
}

/**
 * 使用其他生图引擎 (即梦, 可灵, MJ) 生成图片
 */
export async function generateWithOtherImageEngine(
  description: string,
  engine: "jimeng" | "kling" | "mj",
  apiKey: string,
  aspectRatio: string = "16:9"
): Promise<string> {
  // 注意：此处代码为示意不同引擎的 API 调用逻辑。
  // 实际生产中应根据各家厂商的最新 API 文档进行对接。
  
  const prompt = description;
  
  // 示意端点
  const endpointMap = {
    jimeng: "https://api.dreamina.com/v1/gen/t2i",
    kling: "https://api.klingai.com/v1/images/generations",
    mj: "https://api.mj-proxy.com/v1/mj/submit/imagine" // 假设是一个中转类 API
  };

  try {
    // 统一以 MJ 中转格式为例，或按需细化
    const res = await fetch(endpointMap[engine], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        prompt: prompt,
        aspect_ratio: aspectRatio,
        engine: engine
      })
    });

    if (!res.ok) throw new Error(`${engine} 生成请求失败: ${res.statusText}`);
    const data = await res.json();
    
    // 如果是异步任务（如 MJ），此处可能需要轮询获取结果。这里简化处理。
    return data.url || data.image_url || data.data?.[0]?.url || "";
  } catch (err) {
    console.error(`${engine} generation failed`, err);
    throw err;
  }
}

export async function generateFrameImage(
  description: string, 
  globalStyle?: string,
  projectContext?: string,
  aspectRatio: string = "16:9",
  customApiKey?: string
): Promise<string> {
  const currentAi = customApiKey ? new GoogleGenAI({ apiKey: customApiKey }) : ai;
  const isDefaultKey = !customApiKey;
  
  // 使用正式版 3.1 Flash Image 模型
  let model = "gemini-3.1-flash-image";
  
  const prompt = `
    视觉创作指令 (Visual Directive):
    1. 风格总控 (Style): ${globalStyle || "Cinematic Movie, highly detailed concept art"}
    2. 项目一致性约束 (Consistency): ${projectContext || "Default cinematic settings"}
    3. 当前分镜描述 (Target): ${description}
    
    生成指令：请根据“项目一致性约束”中提到的角色和场景设定，结合“分镜描述”中的动作，以“风格总控”定义的艺术风格生成一张高质量图片。
  `.trim();
  
  try {
    const response = await currentAi.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (err: any) {
    const errorMsg = JSON.stringify(err);
    if (errorMsg.includes("429") && isDefaultKey) {
       throw new Error("GEMINI_IMAGE_QUOTA_EXHAUSTED: 系统共享生图额度已耗尽。请在侧边栏底部的『API管理』中配置您个人的 Gemini API Key 以继续使用。 (You can get a free key at aistudio.google.com)");
    }
    throw err;
  }

  throw new Error("Image generation failed");
}

export async function generateGridImage(
  frames: { number: number, description: string }[],
  globalStyle?: string,
  projectContext?: string,
  aspectRatio: string = "16:9",
  customApiKey?: string
): Promise<string> {
  const currentAi = customApiKey ? new GoogleGenAI({ apiKey: customApiKey }) : ai;
  const model = "gemini-3.1-flash-image";
  
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
        imageSize: "4K"
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
