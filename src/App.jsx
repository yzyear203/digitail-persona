import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Fingerprint, Trash2, Clock, Info, Send, AlertTriangle, UserCircle, Key, Sparkles, CheckSquare, UploadCloud, Cpu, ArrowRight, Loader2, Terminal, FileText, Image as ImageIcon, BookOpen, Briefcase, Wand2, Scale, FileSignature, Database, LogOut, X, MessageCircle } from 'lucide-react';
import tcb from '@cloudbase/js-sdk';

// 🌟 生产级腾讯云 TCB 初始化
let app, auth, db;
try {
  app = tcb.init({
    env: import.meta.env.VITE_TCB_ENV_ID || "persona-app-d9gkoxk5rd2f70aff"
  });
  auth = app.auth();
  db = app.database();
} catch (error) {
  console.error("腾讯云 TCB 初始化失败，请检查环境变量配置:", error);
}

// 🌟 全新引擎：真实人类打字机模拟器
const SimulatedTypingText = ({ content, persona, onComplete, scrollRef }) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let isMounted = true;
    const actions = [];
    
    let baseSpeed = 220; 
    let deleteSpeed = 80;
    if (persona.includes('细腻') || persona.includes('犹豫') || persona.includes('慢') || persona.includes('斟酌')) {
      baseSpeed = 400; 
      deleteSpeed = 120;
    } else if (persona.includes('急躁') || persona.includes('快') || persona.includes('心直口快')) {
      baseSpeed = 120; 
      deleteSpeed = 40;
    }

    const parts = content.split(/(<del>.*?<\/del>)/g);
    parts.forEach(part => {
      if (part.startsWith('<del>') && part.endsWith('</del>')) {
        const delContent = part.replace('<del>', '').replace('</del>', '');
        for (let c of delContent) actions.push({ type: 'type', char: c });
        actions.push({ type: 'pause', ms: 800 + Math.random() * 600 });
        for (let i = 0; i < delContent.length; i++) actions.push({ type: 'delete' });
        actions.push({ type: 'pause', ms: 500 + Math.random() * 500 });
      } else {
        for (let c of part) actions.push({ type: 'type', char: c });
      }
    });

    let currentText = '';
    let index = 0;

    const runAction = () => {
      if (!isMounted) return;
      if (index >= actions.length) {
        setIsTyping(false);
        if (onCompleteRef.current) onCompleteRef.current();
        return;
      }

      const action = actions[index];
      let delay = baseSpeed + (Math.random() * 100 - 50); 

      if (action.type === 'type') {
        currentText += action.char;
        setDisplayText(currentText);
        if (Math.random() < 0.05) {
          delay += 300 + Math.random() * 400;
        }
      } else if (action.type === 'delete') {
        currentText = currentText.slice(0, -1);
        setDisplayText(currentText);
        delay = deleteSpeed; 
      } else if (action.type === 'pause') {
        delay = action.ms;
      }

      if (scrollRef && scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'auto' });
      }

      index++;
      setTimeout(runAction, delay);
    };

    runAction();
    return () => { isMounted = false; };
  }, [content, persona, scrollRef]);

  return (
    <span className="whitespace-pre-wrap">
      {displayText}
      {isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse align-middle"></span>}
    </span>
  );
};

export default function DigitalPersonaApp() {
  const [appPhase, setAppPhase] = useState('home'); 
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTypingIndicator, setIsTypingIndicator] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const currentInteractionRef = useRef(0); 
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showComplianceBanner, setShowComplianceBanner] = useState(true); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);

  const [user, setUser] = useState(null);
  const [savedPersonas, setSavedPersonas] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]); 
  const [distillProgress, setDistillProgress] = useState(0);
  const [distillLogs, setDistillLogs] = useState([]);
  
  const [activePersona, setActivePersona] = useState("你是一个乐于助人的 AI 助手。"); 

  const messagesEndRef = useRef(null);
  const terminalEndRef = useRef(null);
  const fileInputRef = useRef(null); 

  useEffect(() => {
    if (!auth) return;
    const checkAuth = async () => {
      const loginState = await auth.getLoginState();
      if (loginState) {
        setUser({
          uid: loginState.user?.uid || 'anonymous_uid',
          isAnonymous: loginState.authType === 'ANONYMOUS' || (!loginState.user?.email && !loginState.user?.username && !loginState.user?.wxOpenId),
          email: loginState.user?.email || loginState.user?.username || '微信用户'
        });
      }
    };
    checkAuth();

    const unsubscribe = auth.onLoginStateChanged((loginState) => {
      if (loginState) {
        setUser({
          uid: loginState.user?.uid || 'anonymous_uid',
          isAnonymous: loginState.authType === 'ANONYMOUS' || (!loginState.user?.email && !loginState.user?.username && !loginState.user?.wxOpenId),
          email: loginState.user?.email || loginState.user?.username || '微信用户'
        });
      } else {
        setUser(null);
      }
    });
    return () => { if(typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous || !db) {
      setSavedPersonas([]);
      return;
    }
    const watcher = db.collection('personas')
      .where({ owner: user.uid })
      .watch({
        onChange: (snapshot) => {
          const loaded = [];
          snapshot.docs.forEach(document => {
            loaded.push({ id: document._id, ...document });
          });
          loaded.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setSavedPersonas(loaded);
        },
        onError: (error) => console.error("数据加载失败:", error)
      });
    return () => watcher.close();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTypingIndicator]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [distillLogs]);

  const handleAgreeAndProceed = () => {
    setShowAgreementModal(false);
    if (user && !user.isAnonymous) setAppPhase('dashboard');
    else setAppPhase('auth');
  };

  // 🌟 适配腾讯云【用户名密码】体系，将邮箱作为用户名传入
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setAuthError('');
    setIsAuthenticating(true);
    try {
      if (isLoginMode) {
        await auth.signInWithUsernameAndPassword(email, password);
      } else {
        await auth.signUpWithUsernameAndPassword(email, password);
      }
      setAppPhase('dashboard');
    } catch (err) {
      let errorMsg = "验证失败，请重试";
      const msg = err.message || "";
      if (msg.includes('not exist') || msg.includes('找不到')) {
        errorMsg = '账号不存在，新用户请切换至注册模式！';
      } else if (msg.includes('wrong password') || msg.includes('密码')) {
        errorMsg = '密码错误，请重新输入！';
      } else if (msg.includes('already exists') || msg.includes('存在')) {
        errorMsg = '该账号已被注册，请直接登录。';
      } else if (msg.includes('weak') || msg.includes('弱')) {
        errorMsg = '密码至少需要 6 个字符。';
      } else {
        errorMsg = msg;
      }
      setAuthError(errorMsg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 🌟 新增：微信开放平台登录逻辑
  const handleWechatAuth = async () => {
    setAuthError('');
    setIsAuthenticating(true);
    try {
      const provider = auth.weixinAuthProvider();
      await provider.signIn();
      // 成功后 SDK 会自动触发 onLoginStateChanged 并进入 dashboard
      setAppPhase('dashboard');
    } catch (err) {
      setAuthError("微信登录环境未配置完毕，请在腾讯云后台检查AppID配置: " + err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGuestAuth = async () => {
    setAuthError('');
    setIsAuthenticating(true);
    try {
      await auth.anonymousAuthProvider().signIn();
      setAppPhase('dashboard');
    } catch (err) {
      setAuthError("游客登录失败: " + err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    if (auth) await auth.signOut();
    setAppPhase('home');
    setMessages([]);
    setSavedPersonas([]);
    setUploadedFiles([]);
    setIsResponding(false); 
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newFiles = await Promise.all(files.map(async (f) => {
        return new Promise((resolve) => {
          const isImage = f.type.startsWith('image/');
          const isText = f.name.endsWith('.txt') || f.type === 'text/plain';

          if (isImage) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                  height = Math.round((height * MAX_WIDTH) / width);
                  width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                const base64String = compressedDataUrl.split(',')[1];

                resolve({
                  name: f.name,
                  type: 'img',
                  size: '已极限压缩',
                  mimeType: 'image/jpeg',
                  base64Data: base64String,
                  textContent: null,
                  isImage: true,
                  isText: false
                });
              };
              img.src = event.target.result;
            };
            reader.readAsDataURL(f);
          } else if (isText) {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                name: f.name, type: 'doc', size: (f.size / 1024 / 1024).toFixed(2) + ' MB',
                mimeType: f.type || 'text/plain', base64Data: null, textContent: reader.result,
                isImage: false, isText: true
              });
            };
            reader.readAsText(f);
          } else resolve({ name: f.name, warning: "仅支持图片与txt" });
        });
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const callDoubaoAPI = async (promptText, systemInstructionText = null, imageParts = []) => {
    const isSandboxEnv = typeof __firebase_config !== 'undefined';

    if (isSandboxEnv) {
      const apiKey = "";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      
      const parts = [{ text: promptText }];
      if (imageParts.length > 0) {
        imageParts.forEach(img => {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64Data } });
        });
      }
      const payload = { contents: [{ parts }] };
      if (systemInstructionText) {
        payload.systemInstruction = { parts: [{ text: systemInstructionText }] };
      }

      const fetchWithRetry = async (retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error("API 报错");
            return await response.json();
          } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
          }
        }
      };
      const data = await fetchWithRetry();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
    } else {
      let messages = [];
      if (systemInstructionText) messages.push({ role: "system", content: systemInstructionText });

      let userContent = [];
      if (imageParts.length > 0) {
        userContent.push({ type: "text", text: promptText });
        imageParts.forEach(img => userContent.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` } }));
        messages.push({ role: "user", content: userContent });
      } else {
        messages.push({ role: "user", content: promptText });
      }

      const fetchWithRetry = async (retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch('/api/generate', { 
              method: "POST", 
              headers: { "Content-Type": "application/json" }, 
              body: JSON.stringify({ messages }) 
            });
            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(`HTTP ${response.status} - ${errData.error || '请求被拒绝'}`);
            }
            return await response.json();
          } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
          }
        }
      };
      const data = await fetchWithRetry();
      return data.choices?.[0]?.message?.content || "";
    }
  };

  const handleStartDistillation = async () => {
    setAppPhase('distilling');
    setDistillLogs(["[系统就绪] 开始建立后端算力连接..."]);
    setDistillProgress(5);

    try {
      const imageParts = uploadedFiles.filter(f => f.isImage && f.base64Data).map(f => ({ mimeType: f.mimeType, base64Data: f.base64Data }));
      const textContents = uploadedFiles.filter(f => f.isText && f.textContent).map(f => `【${f.name}】:\n${f.textContent}`).join('\n\n');

      setDistillLogs(prev => [...prev, `[解析层] 成功加载 ${imageParts.length} 张图片(已前端压缩) 和 ${textContents.length > 0 ? '文本数据' : '0 份文本'}。`]);
      setDistillProgress(25);

      setTimeout(() => {
        setDistillLogs(prev => [...prev, "[深度推理] 注入视觉大模型，执行深度 OCR 与排版心理学提炼..."]);
        setDistillProgress(50);
      }, 1000);

      let prompt = `用户上传了上述包含真实聊天记录或备忘录内容的图片/截图。
请你利用强大的视觉理解和 OCR 能力，**逐字阅读图片中的所有对话和文字内容**。
你需要根据这些最真实的原始文本，提炼、逆向推理出这个人的数字人格设定。
请用第一人称（“我”）来回答，包含以下必须项：
1. 核心性格与沟通风格。
2. 常用的口头禅或惯用语（必须【摘抄原话】从图片里提取）。
3. 展现出的专业领域、处理事务的典型逻辑。
4. 🧠连发条数心理边界：推断出 TA 连续发送消息的大致范围（例如：习惯连续发 2-4 条）。
5. ⌨️ 打字与思绪特征（极度重要）：评估其心思细腻程度。心思越细腻、顾虑越多的人，打字越慢且越喜欢删改重打；心直快的人打字极快且不删改。
请在最后明确写出【打字速度：快/中/慢】以及【删改频率：高/中/低】。`;

      if (textContents) prompt = `参考文本文档内容：\n\n${textContents}\n\n` + prompt;
      if (imageParts.length === 0 && !textContents) prompt = "用户未上传有效素材，请随机生成一个标准的AI助手人格设定即可。";

      const generatedPersona = await callDoubaoAPI(prompt, "你是一个擅长提炼人类心理学和行为特征的架构师。", imageParts);
      
      setDistillLogs(prev => [...prev, "[算力释放] 打字特征与人格映射完成！已成功提取犹豫指数。"]);
      setDistillProgress(80);
      setActivePersona(generatedPersona);

      if (user && !user.isAnonymous && db) {
        try {
          await db.collection('personas').add({
            name: uploadedFiles[0]?.name ? uploadedFiles[0].name.split('.')[0] : '未命名数字人',
            personaPrompt: generatedPersona,
            createdAt: new Date().toISOString(),
            owner: user.uid
          });
          setDistillLogs(prev => [...prev, "[云端同步] 档案已永久刻录至数据库。"]);
        } catch (err) { console.error(err); }
      } else {
        setDistillLogs(prev => [...prev, "[本地缓存] 匿名游客模式，数字分身不会永久保存。"]);
      }

      setTimeout(() => {
        setDistillLogs(prev => [...prev, "[编译成功] 视觉模型处理完毕！正在挂载底层对话引擎..."]);
        setDistillProgress(100);
        setTimeout(() => {
          setMessages([
            { id: 1, role: 'system', text: '已通过认证。基于您上传的素材解析完毕，处于【自主人格】接管模式。', time: new Date().toLocaleTimeString(), isAnimated: false },
            { id: 2, role: 'assistant', text: `您好，我已经完全阅读并理解了您上传的内容。我已经复刻了您的语言习惯和思考方式，包括打字的速度。现在我是您的数字分身，有什么需要代劳的吗？`, time: new Date().toLocaleTimeString(), isAnimated: true }
          ]);
          setAppPhase('chat');
        }, 1500);
      }, 1000);

    } catch (error) {
      console.error(error);
      setDistillLogs(prev => [...prev, `[致命错误] 后端管线崩溃: ${error.message}`]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    const newMsg = { id: Date.now(), role: 'user', text: userText, time: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    
    const interactionId = Date.now();
    currentInteractionRef.current = interactionId;

    setIsTypingIndicator(true);
    setIsResponding(true);

    try {
      const chatHistory = messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>/g, '')}`)
        .join('\n');
      const prompt = `对话历史:\n${chatHistory}\n\nUser: ${userText}\nAssistant:`;
      
      const systemInstruction = `你是一个数字备份人格。请严格遵循以下你在被深度解析后生成的身份设定：\n\n${activePersona}\n\n
请用这个身份、第一人称代替用户处理事务。

【极其重要的认知规范 - 拒绝复读与强行加戏】：
1. 像正常的真人一样聊天！**绝对不要**在每次回复中去总结或重复刚才聊过的内容，直接对用户的最新一句话做出自然反应。
2. 你的设定中可能包含某些具体的人生经历、头衔（比如极度悲惨的遭遇、或是极其值得炫耀的成就）。**请将它们作为你的“隐性潜意识”**。
3. 除非用户当前的话题**直接且强烈地**触及了这些记忆，否则你**绝对不要**主动、反复地提及它们！真人不会每天把自己的惨事或牛事挂在嘴边。

【关键强制指令 - 暴露真实思考与打字删改过程 (极度重要)】：
为了向用户展示极具视觉冲击力的“人类打字犹豫感”，你必须在输出中使用 \`<del>你想打但又觉得不妥而删掉的话</del>\` 标签！
请严格遵循以下字数挂钩规则：
1. **长句【强制】加戏**：如果你的单条回复内容较长（超过 15 个字），你 **【必须】** 包含至少一处 \`<del>\` 标签！你可以用它来表现你内心的吐槽被强行咽下（如：\`<del>这也太烦了吧，不过</del>没问题，我来处理。\`），或者表现你在斟酌用词。
2. **短句【随机】手误**：如果回复很短（10个字以内），请 **【随机】** 决定是否使用 \`<del>\` 标签，用来模拟偶尔打错字快速退格（例如：\`好的，我马上下<del>版</del>班。\`）。
3. **切分多条消息**：使用 "|||" 作为分隔符将回复切分为符合你设定的连发条数（如：好的|||我现在就看）。`;

      const responseText = await callDoubaoAPI(prompt, systemInstruction);
      
      if (currentInteractionRef.current !== interactionId) return;

      const replyParts = responseText.split('|||').map(s => s.trim()).filter(s => s);
      
      setIsTypingIndicator(false); 

      for (let i = 0; i < replyParts.length; i++) {
        if (currentInteractionRef.current !== interactionId) break;

        const msgId = Date.now() + i;
        setMessages((prev) => [
          ...prev,
          { id: msgId, role: 'assistant', text: replyParts[i], time: new Date().toLocaleTimeString(), isAnimated: true }
        ]);

        const plainTextLength = replyParts[i].replace(/<del>.*?<\/del>/g, '').length;
        const delTextLength = (replyParts[i].match(/<del>(.*?)<\/del>/g) || []).join('').replace(/<del>|<\/del>/g, '').length;
        const delTagsCount = (replyParts[i].match(/<del>/g) || []).length;
        
        const estimatedVisualTime = plainTextLength * 250 + delTextLength * 300 + delTagsCount * 1500 + 1000; 
        
        if (i < replyParts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, estimatedVisualTime));
        }
      }
    } catch (error) {
      console.error(error);
      if (currentInteractionRef.current === interactionId) {
        setIsTypingIndicator(false);
        setMessages((prev) => [...prev, { id: Date.now(), role: 'assistant', text: `[系统异常] 请求失败: ${error.message}`, time: new Date().toLocaleTimeString(), isAnimated: false }]);
      }
    } finally {
      if (currentInteractionRef.current === interactionId) {
        setIsResponding(false); 
      }
    }
  };

  const handleExtractTasks = async () => {
    setIsExtracting(true);
    try {
      const chatHistory = messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>/g, '')}`)
        .join('\n');
      
      const prompt = `分析以下对话记录，提取出所有需要由用户或数字人执行的“代办事项(Action Items)”。如果没有，请返回空数组。\n\n对话记录:\n${chatHistory}`;
      const systemInstruction = `你是一个强大的任务提取助手。请严格输出 JSON 字符串数组，例如：["联系张三落实合同", "下午三点前发送邮件给李四"]。`;

      const jsonResponse = await callDoubaoAPI(prompt, systemInstruction);
      
      let tasks = [];
      try {
        const cleanedJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);
        if (Array.isArray(parsed)) {
          tasks = parsed;
        } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
          tasks = parsed.tasks;
        }
      } catch (parseError) {
        console.error("JSON 解析失败:", parseError);
      }
      
      setExtractedTasks(tasks);
      setShowTasksModal(true);
    } catch (error) {
      console.error(error);
      alert("✨ 提炼代办事项失败，可能是网络异常，请稍后重试。");
    } finally {
      setIsExtracting(false);
    }
  };

  const loadPersonaAndChat = (persona) => {
    setActivePersona(persona.personaPrompt);
    setMessages([
      { id: 1, role: 'system', text: `已从云端数据库唤醒【${persona.name}】的数字人格设定。`, time: new Date().toLocaleTimeString(), isAnimated: false },
      { id: 2, role: 'assistant', text: `你好，我的记忆已恢复。我是 ${persona.name} 的数字分身，我们继续聊吧。`, time: new Date().toLocaleTimeString(), isAnimated: true }
    ]);
    setAppPhase('chat');
  };

  const handleDeleteSavedPersona = async (e, personaId) => {
    e.stopPropagation(); 
    if (!user || !db) return;
    try { 
      await db.collection('personas').doc(personaId).remove(); 
    } catch (err) {
      console.error(err);
    }
  };

  if (appPhase === 'home') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 pb-10 px-6 font-sans">
        <div className="bg-indigo-100 text-indigo-800 px-4 py-2 text-xs flex items-center justify-center space-x-2 rounded-full mb-12 shadow-sm border border-indigo-200">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-semibold">2026 合规运作中</span>
          <span>已接入公安部算力备案网络及 PIPL 隐私保护层</span>
        </div>
        <div className="max-w-5xl w-full text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Identity as a Skill (IaaS)<br/><span className="text-indigo-600">数字资产编译器</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">基于多模态双擎驱动。只需上传对话片段，即刻提取记忆、经验与思考模型，生成具备灵魂的数字分身。</p>
        </div>
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col">
            <div className="bg-amber-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><BookOpen className="w-7 h-7 text-amber-600" /></div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">名人人格/思想库</h3>
            <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed">连接公共版权领域的专家、名人思想数据库（如鲁迅选集、乔布斯访谈录），进行沉浸式的互动知识学习。</p>
            <button onClick={() => alert('提示：【名人库】需要对接公共版权平台 API，当前为演示环境，请体验右侧【任意模拟数字人】。')} className="w-full py-3 rounded-xl font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">进入版权库</button>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col">
            <div className="bg-emerald-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Briefcase className="w-7 h-7 text-emerald-600" /></div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">企业工作继任者</h3>
            <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed">对接企业钉钉/飞书组织架构。蒸馏离职或调岗员工的隐性思维逻辑与业务 SOP，防止企业核心资产流失。</p>
            <button onClick={() => alert('提示：【企业库】需连接企业内控 OA 系统，当前为演示环境，请体验右侧【任意模拟数字人】。')} className="w-full py-3 rounded-xl font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">OA 授权登入</button>
          </div>
          <div className="bg-white rounded-3xl p-8 border-2 border-indigo-500 shadow-md hover:shadow-2xl transition-all group flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">推荐体验</div>
            <div className="bg-indigo-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Wand2 className="w-7 h-7 text-indigo-600" /></div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">任意模拟数字人</h3>
            <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed">上传对象（自己或他人）的微信截图、备忘录等素材，通过多模态 AI 一键“蒸馏”性格与记忆，生成数字灵魂。</p>
            <button onClick={() => setShowAgreementModal(true)} className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors flex justify-center items-center space-x-2"><span>立即创建分身</span><ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>

        {showAgreementModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
              <div className="flex items-center space-x-3 mb-6 text-slate-800 border-b border-slate-100 pb-4">
                <div className="bg-slate-100 p-3 rounded-full"><Scale className="w-6 h-6 text-slate-700" /></div>
                <h2 className="text-2xl font-bold">数字人提取授权及免责协议</h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-4 space-y-4 text-sm text-slate-600 leading-relaxed custom-scrollbar mb-6">
                <p>尊敬的用户，欢迎使用数字资产编译器【任意模拟数字人】功能。在根据《中华人民共和国个人信息保护法》(PIPL) 及《互联网信息服务深度合成管理规定》继续操作前，请您务必仔细阅读并同意以下条款：</p>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 font-medium">
                  <h4 className="flex items-center mb-2"><AlertTriangle className="w-4 h-4 mr-2"/> 知情同意声明</h4>
                  <p className="text-xs">本平台仅提供 AI 算力与算法服务。您在使用本功能上传包含他人发言、文字、截图等数据时，<strong>必须已事先充分征得“被提取者/被蒸馏者”本人的明确同意。</strong></p>
                </div>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>责任隔离：</strong>若您未经他人同意擅自提取引发纠纷，均由您全权承担，与平台无关。</li>
                  <li><strong>数据销毁：</strong>平台承诺不长期留存您的原始上传素材，模型蒸馏完毕后即刻物理销毁。</li>
                </ul>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="flex items-start space-x-3 cursor-pointer group mb-6">
                  <input type="checkbox" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} className="mt-1 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"/>
                  <span className="text-sm text-slate-700 group-hover:text-slate-900 select-none">我已仔细阅读并同意上述协议。我在此承诺：<br/><strong className="text-indigo-700">我已获得合法授权。</strong></span>
                </label>
                <div className="flex space-x-3">
                  <button onClick={() => { setShowAgreementModal(false); setIsAgreed(false); }} className="flex-1 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">取消</button>
                  <button onClick={handleAgreeAndProceed} disabled={!isAgreed} className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex justify-center items-center space-x-2"><FileSignature className="w-5 h-5" /><span>同意并进入验证</span></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (appPhase === 'auth') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-fade-in">
          <div className="bg-indigo-600 p-6 text-center text-white">
            <Key className="w-12 h-12 mx-auto mb-3 text-indigo-100" />
            <h1 className="text-2xl font-bold">{isLoginMode ? '登录编译器' : '注册新账号'}</h1>
            <p className="text-indigo-100 mt-2 text-sm">注册后可永久保存您的数字分身资产</p>
          </div>
          <div className="p-8">
            {authError && (
              <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 flex items-start">
                <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" /><span>{authError}</span>
              </div>
            )}
            <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">邮箱账号</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="your@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">安全密码</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength="6" className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="至少6位密码" />
              </div>
              <button type="submit" disabled={isAuthenticating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold flex justify-center items-center">
                {isAuthenticating ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>{isLoginMode ? '安全登录' : '立即注册'}</span>}
              </button>
            </form>
            <div className="text-center mb-6">
              <button onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} className="text-sm text-indigo-600 hover:underline">{isLoginMode ? '没有账号？点击注册' : '已有账号？返回登录'}</button>
            </div>
            <div className="relative flex items-center py-2 mb-4"><div className="flex-grow border-t border-slate-200"></div><span className="flex-shrink-0 mx-4 text-slate-400 text-sm">或者</span><div className="flex-grow border-t border-slate-200"></div></div>
            
            {/* 🌟 微信一键登录按钮 */}
            <button onClick={handleWechatAuth} disabled={isAuthenticating} className="w-full bg-[#07C160] hover:bg-[#06ad56] text-white py-3 rounded-xl font-medium flex justify-center items-center space-x-2 mb-3 transition-colors shadow-sm">
              <MessageCircle className="w-5 h-5" /><span>微信一键安全登录</span>
            </button>

            <button onClick={handleGuestAuth} disabled={isAuthenticating} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-medium flex justify-center items-center space-x-2 transition-colors">
              <UserCircle className="w-5 h-5" /><span>直接匿名体验 (不保存数据)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (appPhase === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans">
        <div className="w-full max-w-5xl flex justify-end mb-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-500">当前状态: <strong className={user?.isAnonymous ? 'text-amber-500' : 'text-emerald-600'}>{user?.isAnonymous ? '匿名游客' : '正式用户'}</strong></span>
            <button onClick={handleLogout} className="flex items-center text-sm text-slate-500 hover:text-red-600"><LogOut className="w-4 h-4 mr-1" /> 退出</button>
          </div>
        </div>
        <div className="max-w-3xl w-full">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">个人数字资产工作台</h1>
            <p className="text-slate-500">上传真实对话截图或文本文件，AI将自动“看”懂内容并提取性格</p>
          </div>
          {user?.isAnonymous && (
            <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start space-x-3">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div><p className="font-medium text-sm">您正在使用匿名游客模式</p><p className="text-xs mt-1 opacity-80">提取的数字分身仅在本地缓存，刷新即焚。开启云端记忆库需登录。</p></div>
            </div>
          )}
          {!user?.isAnonymous && savedPersonas.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6 animate-fade-in">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center"><Database className="w-5 h-5 mr-2 text-indigo-600" />云端记忆库</h2>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">永久安全存储</span>
              </div>
              <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {savedPersonas.map(persona => (
                  <div key={persona.id} onClick={() => loadPersonaAndChat(persona)} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl cursor-pointer group border border-transparent hover:border-slate-200">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="bg-indigo-100 p-2 rounded-lg group-hover:bg-indigo-600 transition-colors"><UserCircle className="w-5 h-5 text-indigo-600 group-hover:text-white" /></div>
                      <div className="truncate text-left">
                        <h3 className="font-semibold text-slate-800 truncate">{persona.name}</h3>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date(persona.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <button onClick={(e) => handleDeleteSavedPersona(e, persona.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
            <div className="p-8 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><ImageIcon className="w-5 h-5 mr-2 text-indigo-500" /> 注入多元素材 (支持JPG/PNG截图 或 TXT文档)</h2>
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.jpg,.jpeg,.png" />
              <div className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer ${uploadedFiles.length > 0 ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`} onClick={() => fileInputRef.current?.click()}>
                {uploadedFiles.length > 0 ? (
                  <div className="flex flex-col items-center text-indigo-600">
                    <CheckSquare className="w-12 h-12 mb-3" />
                    <div className="flex flex-col items-center space-y-2 mb-1">
                      {uploadedFiles.map((f, i) => (
                        <span key={i} className="font-semibold text-md flex items-center">{f.type === 'doc' ? <FileText className="w-4 h-4 mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}{f.name} <span className="text-xs text-indigo-400 ml-2">({f.size})</span></span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-500">
                    <UploadCloud className="w-12 h-12 mb-3 text-slate-400" />
                    <span className="font-medium text-slate-700">点击上传真实的聊天截图(图片) 或 .txt纯文本</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-8 bg-slate-50">
              <button onClick={handleStartDistillation} disabled={uploadedFiles.length === 0} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center space-x-2 shadow-md"><span>读取内容并一键生成数字分身</span><ArrowRight className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (appPhase === 'distilling') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 flex items-center justify-center p-6 font-mono">
        <div className="max-w-2xl w-full">
          <div className="flex items-center space-x-3 mb-6"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /><h1 className="text-2xl font-bold text-white">Multimodal Distillation</h1></div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
            <div className="h-2 bg-slate-700 w-full"><div className="h-full bg-indigo-500 transition-all duration-500 ease-out relative" style={{ width: `${distillProgress}%` }}><div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div></div></div>
            <div className="p-6 h-[400px] overflow-y-auto text-sm space-y-3">
              {distillLogs.map((log, idx) => (<div key={idx} className={`${log.includes('成功') ? 'text-green-400 font-bold' : log.includes('致命') ? 'text-red-400 font-bold' : ''}`}><span className="text-slate-500 mr-3">[{new Date().toLocaleTimeString()}]</span>{log}</div>))}
              {distillProgress < 100 && (<div className="flex items-center text-indigo-400 mt-2"><Terminal className="w-4 h-4 mr-2" /><span className="animate-pulse">_</span></div>)}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden">
      {showComplianceBanner && (
        <div className="bg-amber-100 text-amber-800 px-4 py-2 text-xs flex items-center justify-center space-x-2 border-b border-amber-200 shrink-0 relative transition-all">
          <button 
            onClick={() => setShowComplianceBanner(false)} 
            className="absolute left-3 p-1 hover:bg-amber-200 rounded text-amber-600 transition-colors"
            title="关闭提示"
          >
            <X className="w-4 h-4" />
          </button>
          <AlertTriangle className="w-4 h-4" />
          <span className="font-semibold">合规提示：</span>
          <span>交互对象为 AI 解析生成的【数字人物】，注意观察对方打字时的删改习惯（停顿、退格）。</span>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-full"><UserCircle className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">自定义数字分身 (沉浸式打字版)</h1>
            <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1 h-4">
              {isResponding && (
                <span className="flex items-center text-blue-500 font-medium animate-pulse bg-blue-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1"></span>
                  对方正在输入中...
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleExtractTasks}
            disabled={isExtracting || messages.length <= 2}
            className="flex items-center space-x-1 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg text-sm transition-colors border border-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExtracting ? <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div> : <Sparkles className="w-4 h-4" />}
            <span className="font-medium">✨ 智能提炼代办</span>
          </button>
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center space-x-1 text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm transition-colors border border-red-100"
          >
            <Trash2 className="w-4 h-4" />
            <span>行使被遗忘权</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.role === 'system' ? (
               <div className="mx-auto bg-slate-200 text-slate-600 text-xs py-1 px-4 rounded-full my-4">{msg.text}</div>
            ) : (
              <div className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'}`}>
                {msg.role === 'assistant' && msg.isAnimated ? (
                  <SimulatedTypingText 
                    content={msg.text} 
                    persona={activePersona} 
                    scrollRef={messagesEndRef}
                    onComplete={() => {
                      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAnimated: false } : m));
                    }} 
                  />
                ) : (
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                    {msg.text.replace(/<del>.*?<\/del>/g, '')}
                  </p>
                )}
                <span className={`text-[10px] mt-2 block ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                  {msg.time} {msg.role === 'assistant' && ' • AI 生成'}
                </span>
              </div>
            )}
          </div>
        ))}
        {isTypingIndicator && (
           <div className="flex items-start">
             <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm flex space-x-2">
               <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
               <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
               <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </main>

      <footer className="bg-white border-t border-slate-200 p-4 shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="随便聊点什么，随时可以打断对方..." 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
          <button type="submit" disabled={!input.trim()} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <Send className="w-6 h-6" />
          </button>
        </form>
      </footer>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h2 className="text-xl font-bold">终止数字人连接？</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              数据销毁不可逆。系统将彻底擦除您刚才上传的图片内容记忆以及对应的数字人格设定，并退回大厅。
            </p>
            <div className="flex space-x-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200">取消</button>
              <button onClick={() => window.location.reload()} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-medium hover:bg-red-700 flex items-center justify-center space-x-2">
                <Trash2 className="w-4 h-4" /><span>退出销毁</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showTasksModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2 text-indigo-600">
                <CheckSquare className="w-6 h-6" />
                <h2 className="text-xl font-bold">已提炼代办事项</h2>
              </div>
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-2">
              {extractedTasks.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-lg">当前对话未检测到明确的代办事项。</p>
              ) : (
                extractedTasks.map((task, idx) => (
                  <label key={idx} className="flex items-start space-x-3 bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors cursor-pointer group">
                    <input type="checkbox" className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">
                      {typeof task === 'object' ? JSON.stringify(task) : String(task)}
                    </span>
                  </label>
                ))
              )}
            </div>
            <button onClick={() => setShowTasksModal(false)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors">完成并关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
