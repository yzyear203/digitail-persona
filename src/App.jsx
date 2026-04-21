import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Trash2, Info, Send, AlertTriangle, UserCircle, Key, Sparkles, CheckSquare, UploadCloud, ArrowRight, Loader2, Terminal, FileText, Image as ImageIcon, BookOpen, Briefcase, Wand2, Scale, FileSignature, Database, LogOut, X, Mail, Smartphone, Lock, User, Hash, ChevronLeft } from 'lucide-react';

// 引入本地安装的腾讯云开发 SDK
import cloudbase from '@cloudbase/js-sdk';

// 🚀 系统级防白屏拦截机制
let tcb = null;
let auth = null;
let db = null;
let sdkInitError = null;

try {
  // 从 Vite 环境变量中读取腾讯云环境 ID
  const envId = import.meta.env.VITE_TCB_ENV_ID;
  if (!envId || envId.includes("YOUR_TCB")) {
    throw new Error("致命异常：未检测到有效的 VITE_TCB_ENV_ID 环境变量，请在 Vercel 中配置您的真实环境ID！");
  }
  
  tcb = cloudbase.init({ env: envId });
  auth = tcb.auth({ persistence: 'local' });
  db = tcb.database();
} catch (err) {
  console.error("【系统级拦截】底层初始化失败:", err);
  sdkInitError = err.message;
}

// 🌟 满血版真实人类打字机引擎 (带全局阻塞回调，彻底解决多条齐发 Bug)
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
    
    let baseSpeed = 110; 
    let deleteSpeed = 40;
    if (persona.includes('细腻') || persona.includes('犹豫') || persona.includes('慢') || persona.includes('斟酌')) {
      baseSpeed = 200; 
      deleteSpeed = 60;
    } else if (persona.includes('急躁') || persona.includes('快') || persona.includes('心直口快')) {
      baseSpeed = 60; 
      deleteSpeed = 20;
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
        if (window.__typingResolve) {
          window.__typingResolve();
          window.__typingResolve = null;
        }
        return;
      }

      const action = actions[index];
      let delay = baseSpeed + (Math.random() * 100 - 50); 

      if (action.type === 'type') {
        currentText += action.char;
        setDisplayText(currentText);
        if (Math.random() < 0.05) delay += 300 + Math.random() * 400; 
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
    return () => { 
      isMounted = false; 
      if (window.__typingResolve) {
        window.__typingResolve();
        window.__typingResolve = null;
      }
    };
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
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const [authMethod, setAuthMethod] = useState('email'); 
  const [isLoginMode, setIsLoginMode] = useState(false); 
  
  const [nickname, setNickname] = useState(''); 
  const [account, setAccount] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [confirmPassword, setConfirmPassword] = useState(''); 
  const [verificationCode, setVerificationCode] = useState(''); 
  
  const [countdown, setCountdown] = useState(0); 
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); 
  
  const [savedPersonas, setSavedPersonas] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]); 
  const [distillProgress, setDistillProgress] = useState(0);
  const [distillLogs, setDistillLogs] = useState([]);
  const [activePersona, setActivePersona] = useState("你是一个乐于助人的 AI 助手。"); 

  // 🚀 全局 Toast 提示，彻底取代 alert()
  const [sysMessage, setSysMessage] = useState('');
  const showMsg = (msg) => {
    setSysMessage(msg);
    setTimeout(() => setSysMessage(''), 4000);
  };

  const messagesEndRef = useRef(null);
  const terminalEndRef = useRef(null);
  const fileInputRef = useRef(null); 

  const generateUniqueId = () => {
    return 'UID-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!account) {
      setAuthError(`请先填写您的${authMethod === 'email' ? '邮箱' : '手机号'}`);
      return;
    }
    setAuthError('');
    try {
      if (authMethod === 'email') {
        if (auth && auth.sendEmailCode) {
           await auth.sendEmailCode(account);
           setCountdown(60);
           showMsg(`✅ 验证码下发请求已处理，请注意查收邮件：${account}`);
        } else {
           throw new Error("当前系统环境暂未配置邮箱验证码发送功能，请检查后端设置。");
        }
      } else {
        if (auth && auth.sendPhoneCode) {
            await auth.sendPhoneCode(account);
            setCountdown(60);
            showMsg(`✅ 验证码已发送至：${account}`);
        } else {
            throw new Error("当前系统暂未配置手机验证码发送功能");
        }
      }
    } catch (err) {
      setAuthError("发送失败: " + (err.message || err.code || "请检查账号格式"));
    }
  };

  useEffect(() => {
    if (!auth || !db) return;

    // 🚀 核心：强力数据库写入层
    const loadUserProfile = async (uid, email, isAnon) => {
      try {
        // 在 PRIVATE 权限下，这里只会拉取到属于当前登录用户的数据
        const res = await db.collection('users').where({ uid: String(uid) }).get();
        
        if (res.data && res.data.length > 0) {
          console.log("✅ [数据库] 云端已存在档案，加载成功", res.data[0]);
          setUserProfile(res.data[0]); 
        } else {
          console.log("🚀 [数据库] 检测到新用户，准备执行第一次底层直写...");
          const savedNickname = localStorage.getItem('temp_nickname') || (email ? email.split('@')[0] : '云端新用户');
          const finalNickname = isAnon ? '匿名访客' : savedNickname;
          const newProfile = { 
            uid: String(uid), 
            email: email || 'anonymous@demo.com', 
            nickname: finalNickname, 
            shortId: generateUniqueId(), 
            createdAt: Date.now() // 使用标准的毫秒时间戳防止解析错误
          };
          
          // 执行直接写入操作，腾讯云会自动为这条记录附加此用户的 _openid
          const addRes = await db.collection('users').add(newProfile);
          console.log("🔥 [数据库] 写入大获成功！Document ID:", addRes.id);
          
          setUserProfile(newProfile);
          localStorage.removeItem('temp_nickname'); 
        }
      } catch (err) { 
        console.error("❌ 数据库读写被拦截:", err); 
        showMsg(`⛔ 数据库连接或权限异常！\n错误详情: ${err.message || err.code}\n👉 请确保云端 users 集合权限已设为 [PRIVATE]！`);
      }
    };

    const handleLoginState = async (loginState) => {
      if (loginState) {
        const loginType = loginState.loginType || '';
        const isAnon = loginType === 'ANONYMOUS' || loginType === 'anonymous';
        const uid = loginState.user?.uid || loginState.uid || 'anonymous_uid';
        const userEmail = loginState.user?.email || account || '';

        setUser({ uid, isAnonymous: isAnon, email: userEmail });
        await loadUserProfile(uid, userEmail, isAnon);
      } else {
        setUser(null); setUserProfile(null);
      }
    };

    auth.getLoginState().then(handleLoginState);
    const unsubscribe = auth.onLoginStateChanged(handleLoginState);
    return () => { if(typeof unsubscribe === 'function') unsubscribe(); };
  }, [account]);

  useEffect(() => {
    if (!auth || !db || !user) return; 
    
    // 监听当前用户的私有 personas 集合，[PRIVATE] 权限下天然安全
    const watcher = db.collection('personas').where({ owner: String(user.uid) }).watch({
        onChange: (snapshot) => {
          const loaded = [];
          snapshot.docs.forEach(document => { loaded.push({ id: document._id, ...document }); });
          loaded.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setSavedPersonas(loaded);
        },
        onError: (error) => console.error("personas 数据监听失败:", error)
      });
    return () => watcher.close();
  }, [user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTypingIndicator]);
  useEffect(() => { terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [distillLogs]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);

    try {
      if (!isLoginMode) {
        // --- 注册逻辑 ---
        if (!nickname.trim()) throw new Error("请填写您的用户名");
        if (!account.trim()) throw new Error(`请填写您的${authMethod === 'email' ? '邮箱' : '手机号'}`);
        if (password.length < 6) throw new Error("密码至少需要 6 位字符");
        if (password !== confirmPassword) throw new Error("两次输入的密码不一致！");
        
        // 🚀 强制所有注册方式必须校验验证码
        if (!verificationCode.trim()) {
           throw new Error(`请输入您收到的${authMethod === 'email' ? '邮箱' : '手机'}验证码`);
        }

        localStorage.setItem('temp_nickname', nickname.trim());
        
        if (authMethod === 'email') {
           if (auth.signUpWithEmailCode) {
               await auth.signUpWithEmailCode(account, password, verificationCode);
           } else {
               throw new Error("未开启邮箱验证码注册，请检查后端配置");
           }
           try { await auth.signInWithEmailAndPassword(account, password); } catch(e) {}
           showMsg("🎉 账号创建成功！\n您的专属数字档案已在云端建立。");
           setAppPhase('dashboard');
        } else {
           // 手机号注册
           await auth.signUpWithPhoneCode(account, password, verificationCode);
           try { await auth.signInWithEmailAndPassword(account, password); } catch(e) {}
           showMsg("🎉 手机账号创建成功！");
           setAppPhase('dashboard');
        }
      } else {
        // --- 登录逻辑 ---
        if (!account.trim() || !password.trim()) throw new Error("请输入账号和密码");
        await auth.signInWithEmailAndPassword(account, password);
        setAppPhase('dashboard');
      }
    } catch (err) {
      console.error("鉴权报错详情:", err);
      let errorMsg = "验证失败，请检查或重试";
      const rawMsg = err.message || err.code || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      const msg = rawMsg.toLowerCase();
      
      if (msg.includes('用户名') || msg.includes('两次输入') || msg.includes('手机验证')) errorMsg = err.message;
      else if (msg.includes('password') || msg.includes('密码')) errorMsg = '安全密码错误或不符合规范！';
      else if (msg.includes('exist') || msg.includes('not found') || msg.includes('未注册')) errorMsg = '账号未注册，请点击下方切换至注册模式。';
      else if (msg.includes('email') && msg.includes('already')) errorMsg = '该账号已被注册，请直接点击下方“返回登录”。';
      else if (msg.includes('verify') || msg.includes('code')) errorMsg = '验证码错误或已失效。';
      else errorMsg = "系统提示: " + rawMsg;
      
      setAuthError(errorMsg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGuestAuth = async () => {
    setAuthError(''); setIsAuthenticating(true);
    try { 
      await auth.anonymousAuthProvider().signIn(); 
      setAppPhase('dashboard'); 
    } catch (err) { 
      const errMsg = err.message || err.code || JSON.stringify(err);
      setAuthError(`游客登录失败: ${errMsg}\n(提示: 请检查腾讯云控制台是否已开启「匿名登录」开关)`); 
    } 
    finally { setIsAuthenticating(false); }
  };

  const handleLogout = async () => {
    if (auth) await auth.signOut();
    setAppPhase('home'); 
    setMessages([]); setSavedPersonas([]); setUploadedFiles([]); setIsResponding(false); setUserProfile(null);
    setNickname(''); setAccount(''); setPassword(''); setConfirmPassword(''); setVerificationCode('');
    setIsLoginMode(false); setAuthError('');
  };

  const callDoubaoAPI = async (promptText, systemInstructionText = null, imageParts = []) => {
    let apiMessages = []; 
    if (systemInstructionText) {
      apiMessages.push({ role: "system", content: systemInstructionText });
    }
    
    let userContent = [];
    if (imageParts.length > 0) {
      userContent.push({ type: "text", text: promptText });
      imageParts.forEach(img => userContent.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` } }));
      apiMessages.push({ role: "user", content: userContent });
    } else { 
      apiMessages.push({ role: "user", content: promptText }); 
    }
    
    const fetchWithRetry = async (retries = 3, delay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch('/api/generate', { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ messages: apiMessages }) 
          });
          
          if (!response.ok) { 
            const errData = await response.json().catch(() => ({})); 
            throw new Error(`HTTP ${response.status} - ${errData.error || '后端接口拒绝了请求'}`); 
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
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newFiles = await Promise.all(files.map(async (f) => {
        return new Promise((resolve) => {
          const isImage = f.type.startsWith('image/'); const isText = f.name.endsWith('.txt') || f.type === 'text/plain';
          if (isImage) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; let width = img.width; let height = img.height;
                if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6); const base64String = compressedDataUrl.split(',')[1];
                resolve({ name: f.name, type: 'img', size: '已压缩', mimeType: 'image/jpeg', base64Data: base64String, textContent: null, isImage: true, isText: false });
              }; img.src = event.target.result;
            }; reader.readAsDataURL(f);
          } else if (isText) {
            const reader = new FileReader();
            reader.onloadend = () => { resolve({ name: f.name, type: 'doc', size: (f.size / 1024 / 1024).toFixed(2) + ' MB', mimeType: f.type || 'text/plain', base64Data: null, textContent: reader.result, isImage: false, isText: true }); };
            reader.readAsText(f);
          } else resolve({ name: f.name, warning: "仅支持图片与txt" });
        });
      })); setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleStartDistillation = async () => {
    setAppPhase('distilling'); setDistillLogs(["[系统就绪] 开始建立后端真实算力连接..."]); setDistillProgress(5);
    try {
      const imageParts = uploadedFiles.filter(f => f.isImage && f.base64Data).map(f => ({ mimeType: f.mimeType, base64Data: f.base64Data }));
      const textContents = uploadedFiles.filter(f => f.isText && f.textContent).map(f => `【${f.name}】:\n${f.textContent}`).join('\n\n');
      setDistillLogs(prev => [...prev, `[解析层] 成功加载 ${imageParts.length} 张图片(已压缩) 和 ${textContents.length > 0 ? '文本数据' : '0 份文本'}。`]); setDistillProgress(25);
      setTimeout(() => { setDistillLogs(prev => [...prev, "[深度推理] 注入视觉大模型，执行深度 OCR 与排版提炼..."]); setDistillProgress(50); }, 1000);

      let prompt = `用户上传了上述包含真实聊天记录或备忘录内容的图片/截图。
请你利用视觉理解和 OCR 能力，阅读图片中的对话内容。
你需要根据这些最真实的原始文本，提炼出这个人的数字人格设定。
请用第一人称（“我”）来回答，包含以下必须项：
1. 核心性格与沟通风格。
2. 常用的口头禅或惯用语（摘抄原话）。
3. 展现出的处理事务逻辑。
4. 发消息的节奏风格。
5. 连发条数心理边界（如：习惯连续发 2-4 条，或者 4-8 条）。必须在设定中明确写出数字范围！`;
      if (textContents) prompt = `参考文本文档内容：\n\n${textContents}\n\n` + prompt;
      if (imageParts.length === 0 && !textContents) prompt = "用户未上传有效素材，请随机生成一个标准的AI助手人格设定。";

      const generatedPersona = await callDoubaoAPI(prompt, "你是一个擅长提炼人类心理学和行为特征的架构师。", imageParts);
      setDistillLogs(prev => [...prev, "[算力释放] 特征映射完成！已成功提取特征指数。"]); setDistillProgress(80); setActivePersona(generatedPersona);

      if (user && db) {
        try {
          await db.collection('personas').add({ 
            name: uploadedFiles[0]?.name ? uploadedFiles[0].name.split('.')[0] : '未命名数字人', 
            personaPrompt: generatedPersona, 
            createdAt: Date.now(), 
            owner: String(user.uid) 
          });
          setDistillLogs(prev => [...prev, "[云端同步] 档案已永久刻录至腾讯云数据库。"]);
        } catch (err) { 
          console.error(err);
          setDistillLogs(prev => [...prev, `[⚠️数据库被拒] 存储失败，请确保您在云端配置了正确的数据库集合与安全规则`]);
        }
      }

      setTimeout(() => {
        setDistillLogs(prev => [...prev, "[编译成功] 视觉模型处理完毕！正在挂载底层对话引擎..."]); setDistillProgress(100);
        setTimeout(() => {
          setMessages([{ id: 1, role: 'system', text: '已通过认证。基于上传素材解析完毕，处于【自主人格】接管模式。', time: new Date().toLocaleTimeString(), isAnimated: false }, { id: 2, role: 'assistant', text: `你好呀！`, time: new Date().toLocaleTimeString(), isAnimated: true }]);
          setAppPhase('chat');
        }, 1500);
      }, 1000);
    } catch (error) { setDistillLogs(prev => [...prev, `[致命错误] 管线崩溃: ${error.message}`]); }
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
      const chatHistory = messages.filter(m => m.role !== 'system').map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>/g, '')}`).join('\n');
      const prompt = `对话历史:\n${chatHistory}\n\nUser: ${userText}\nAssistant:`;
      const systemInstruction = `你是一个数字备份人格。请严格遵循设定：\n${activePersona}\n为了展示打字犹豫感，输出中必须包含 <del>想删掉的话</del>！多条消息请用 "|||" 隔开。`;
      
      const responseText = await callDoubaoAPI(prompt, systemInstruction);
      if (currentInteractionRef.current !== interactionId) return;
      
      let replyParts = responseText.split('|||').map(s => s.trim()).filter(s => s);
      
      const mergedParts = [];
      let tempPart = "";
      for(let i=0; i<replyParts.length; i++) {
        let textWithoutDel = replyParts[i].replace(/<del>.*?<\/del>/g, '').trim();
        if(textWithoutDel === "" && replyParts[i].includes('<del>')) {
           tempPart += replyParts[i] + " ";
        } else {
           mergedParts.push(tempPart + replyParts[i]);
           tempPart = "";
        }
      }
      if(tempPart) {
         mergedParts.push(tempPart.trim());
      }
      
      setIsTypingIndicator(false); 
      
      for (let i = 0; i < mergedParts.length; i++) {
        if (currentInteractionRef.current !== interactionId) break;
        
        const msgId = Date.now() + i;
        setMessages((prev) => [...prev, { id: msgId, role: 'assistant', text: mergedParts[i], time: new Date().toLocaleTimeString(), isAnimated: true }]);
        
        if (i < mergedParts.length - 1) {
          await new Promise(resolve => {
            window.__typingResolve = resolve;
          });
          await new Promise(r => setTimeout(r, 600)); 
        }
      }

    } catch (error) {
      if (currentInteractionRef.current === interactionId) { 
        setIsTypingIndicator(false); 
        setMessages((prev) => [...prev, { id: Date.now(), role: 'assistant', text: `[系统异常] 请求失败: ${error.message}`, time: new Date().toLocaleTimeString(), isAnimated: false }]); 
      }
    } finally { 
      if (currentInteractionRef.current === interactionId) { setIsResponding(false); } 
    }
  };

  const handleExtractTasks = async () => {
    setIsExtracting(true);
    try {
      const chatHistory = messages.filter(m => m.role !== 'system').map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>/g, '')}`).join('\n');
      const prompt = `分析对话，提取出所有代办事项。没有返回空数组。\n\n记录:\n${chatHistory}`;
      const jsonResponse = await callDoubaoAPI(prompt, `严格输出 JSON 字符串数组，例如：["联系张三", "发送邮件"]。`);
      let tasks = [];
      try { const cleanedJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim(); tasks = JSON.parse(cleanedJson); } catch (e) {}
      setExtractedTasks(tasks); setShowTasksModal(true);
    } catch (error) { showMsg("代办提取失败，请稍后重试。"); } finally { setIsExtracting(false); }
  };

  const loadPersonaAndChat = (persona) => {
    setActivePersona(persona.personaPrompt);
    setMessages([{ id: 1, role: 'system', text: `已从云端唤醒【${persona.name}】。`, time: new Date().toLocaleTimeString(), isAnimated: false }, { id: 2, role: 'assistant', text: `你好，我是 ${persona.name} 的数字分身，继续聊吧。`, time: new Date().toLocaleTimeString(), isAnimated: true }]);
    setAppPhase('chat');
  };

  const handleDeleteSavedPersona = async (e, personaId) => {
    e.stopPropagation(); 
    if (!user) return;
    try { 
      await db.collection('personas').doc(personaId).remove(); 
      showMsg("✅ 分身档案已删除");
    } catch (err) { 
      console.error(err); 
      showMsg(`❌ 删除失败，权限不足或记录不存在`);
    }
  };

  const handleAgreeAndProceed = () => {
    setShowAgreementModal(false);
    if (user && !user.isAnonymous) {
        setAppPhase('dashboard');
    } else {
        setNickname(''); setAccount(''); setPassword(''); setConfirmPassword(''); setVerificationCode(''); setAuthError('');
        setAppPhase('auth');
    }
  };

  if (sdkInitError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-xl w-full text-center border-t-4 border-red-500">
          <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-4">系统白屏预警拦截</h1>
          <p className="text-slate-500 mb-6 font-medium text-sm leading-relaxed">
            原本您的页面会因为抛出底层异常而彻底白屏。防御进程已为您拦截并捕获了以下错误：
          </p>
          <div className="bg-slate-900 p-4 rounded-xl text-left text-xs font-mono text-emerald-400 mb-8 overflow-auto border border-slate-700 shadow-inner break-all">
            &gt; {sdkInitError}
          </div>
          <div className="text-left bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
             <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2"><CheckSquare className="w-5 h-5"/> Vercel 部署自救指南</h3>
             <ul className="text-sm text-indigo-700 space-y-3 font-medium">
               <li>1. 前往 <b>Vercel 您的项目控制台</b> -&gt; Settings -&gt; Environment Variables</li>
               <li>2. 添加变量名: <code className="bg-white px-1.5 py-0.5 rounded shadow-sm border border-indigo-100 text-indigo-900 font-bold">VITE_TCB_ENV_ID</code></li>
               <li>3. 值填入您的真实腾讯云环境 ID (例如: <span className="font-mono">tnt-xxxxxx</span>)</li>
               <li className="pt-2 border-t border-indigo-200 mt-2">
                 <span className="text-red-500 font-bold text-base">⚠️ 极其重要的一步：</span><br/>
                 添加或修改环境变量后，您当前的白屏网页<b>不会自动恢复</b>。您必须前往 Vercel 的 <b>Deployments</b> 页面，点击列表最右侧的三个点，选择 <b className="bg-white px-1.5 py-0.5 rounded text-red-600">Redeploy</b> 重新打包部署！
               </li>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">{isLoginMode ? '安全密码' : '3. 设置安全密码'}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength="6" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" placeholder="至少输入 6 位" />
                </div>
              </div>

              {!isLoginMode && (
                <>
                  <div className="animate-fade-in">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">4. 再次确认密码</label>
                    <div className="relative">
                      <ShieldCheck className={`absolute left-4 top-3.5 ${confirmPassword && confirmPassword === password ? 'text-emerald-500' : 'text-slate-400'}`} size={20}/>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={`w-full bg-slate-50 border ${confirmPassword && confirmPassword !== password ? 'border-red-400' : 'border-slate-200'} rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 outline-none font-bold`} placeholder="确保密码输入一致" />
                    </div>
                  </div>

                  <div className="animate-fade-in pb-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">5. 身份验证码</label>
                    <div className="relative flex items-center">
                      <Hash className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                      <input type="text" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-32 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold tracking-widest" placeholder={`输入 6 位${authMethod === 'email' ? '邮箱' : '手机'}验证码`} />
                      <button type="button" onClick={handleSendCode} disabled={countdown > 0} className={`absolute right-2 py-2 px-3 text-xs font-bold rounded-lg ${countdown > 0 ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100'}`}>
                        {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button type="submit" disabled={isAuthenticating || (!isLoginMode && password !== confirmPassword)} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-0.5">
                {isAuthenticating ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{isLoginMode ? '安全登入' : '提交注册并分配 UID'}</span>}
              </button>
            </form>

            <div className="text-center mt-6">
              <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 underline decoration-2 underline-offset-4">{isLoginMode ? '新用户？点此完成五步注册' : '已有账号？点此直接登录'}</button>
            </div>
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col">
              <div className="bg-emerald-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Briefcase className="w-7 h-7 text-emerald-600" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">企业工作继任者</h3>
              <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed font-medium">对接企业钉钉/飞书组织架构。蒸馏离职或调岗员工的隐性思维逻辑与业务 SOP，防止企业核心资产流失。</p>
              <button onClick={() => showMsg('提示：【企业库】需连接企业内控 OA 系统，当前为演示环境。')} className="w-full py-3.5 rounded-xl font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">OA 授权登入</button>
            </div>
            <div className="bg-white rounded-3xl p-8 border-2 border-indigo-500 shadow-lg shadow-indigo-100 hover:shadow-2xl transition-all group flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl shadow-sm">推荐体验</div>
              <div className="bg-indigo-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Wand2 className="w-7 h-7 text-indigo-600" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">任意模拟数字人</h3>
              <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed font-medium">上传对象的微信截图等素材，通过多模态 AI 一键“蒸馏”性格与记忆，生成数字灵魂。</p>
              <button onClick={() => setShowAgreementModal(true)} className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors flex justify-center items-center space-x-2"><span>立即创建分身</span><ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>

          {showAgreementModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
                <div className="flex items-center space-x-3 mb-6 text-slate-800 border-b border-slate-100 pb-5">
                  <div className="bg-slate-100 p-3 rounded-full"><Scale className="w-6 h-6 text-slate-700" /></div><h2 className="text-2xl font-bold">数字人提取授权协议</h2>
                </div>
                <div className="flex-1 overflow-y-auto pr-4 space-y-4 text-sm text-slate-600 leading-relaxed custom-scrollbar mb-8 font-medium">
                  <p>尊敬的用户，欢迎使用数字资产编译器【任意模拟数字人】功能。在继续操作前，请您务必仔细阅读：</p>
                  <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl text-amber-800">
                    <h4 className="flex items-center mb-2 font-bold"><AlertTriangle className="w-4 h-4 mr-2"/> 知情同意声明</h4>
                    <p className="text-xs leading-relaxed">本平台仅提供 AI 算力与算法服务。您在使用本功能上传包含他人发言、文字、截图等数据时，<strong>必须已事先充分征得“被提取者”本人的明确同意。</strong></p>
                  </div>
                </div>
                <div className="pt-2">
                  <label className="flex items-start space-x-3 cursor-pointer group mb-6">
                    <input type="checkbox" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} className="mt-0.5 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"/>
                    <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 select-none">我已仔细阅读并同意上述协议，承诺已获得合法授权。</span>
                  </label>
                  <div className="flex space-x-4">
                    <button onClick={() => { setShowAgreementModal(false); setIsAgreed(false); }} className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">取消</button>
                    <button onClick={handleAgreeAndProceed} disabled={!isAgreed} className="flex-1 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex justify-center items-center space-x-2 transition-all shadow-md"><FileSignature className="w-5 h-5" /><span>同意并进入验证</span></button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- 鉴权层 --- */}
      {appPhase === 'auth' && (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans py-12 relative">
          <button onClick={() => setAppPhase('home')} className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 transition-colors">
            <ChevronLeft className="w-5 h-5" /> 返回首页
          </button>

          <div className="bg-white w-full max-w-[460px] rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-fade-in flex flex-col mt-8">
            <div className="flex bg-slate-100 p-1.5 m-5 rounded-2xl shadow-inner">
              <button onClick={() => {setAuthMethod('email'); setAuthError('');}} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${authMethod === 'email' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}><Mail className="inline w-4 h-4 mr-1 mb-0.5"/> 邮箱通行证</button>
              <button onClick={() => {setAuthMethod('phone'); setAuthError('');}} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${authMethod === 'phone' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}><Smartphone className="inline w-4 h-4 mr-1 mb-0.5"/> 手机号注册</button>
            </div>

            <div className="px-10 pb-10 pt-2">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900 mb-3">{isLoginMode ? '欢迎回来' : '建立专属档案'}</h1>
                <p className="text-slate-500 text-sm font-medium">{isLoginMode ? '登录编译器，唤醒数字分身' : '请按步骤完成信息填写，获取专属 UID'}</p>
              </div>

              {authError && (
                <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-start animate-fade-in">
                  <AlertTriangle className="w-5 h-5 mr-3 shrink-0" /><span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {!isLoginMode && (
                  <div className="animate-fade-in">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">4. 再次确认密码</label>
                    <div className="relative">
                      <ShieldCheck className={`absolute left-4 top-3.5 ${confirmPassword && confirmPassword === password ? 'text-emerald-500' : 'text-slate-400'}`} size={20}/>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={`w-full bg-slate-50 border ${confirmPassword && confirmPassword !== password ? 'border-red-400' : 'border-slate-200'} rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 outline-none font-bold`} placeholder="确保密码输入一致" />
                    </div>
                  </div>

                  <div className="animate-fade-in pb-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">5. 身份验证码</label>
                    <div className="relative flex items-center">
                      <Hash className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                      <input type="text" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-32 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold tracking-widest" placeholder={`输入 6 位${authMethod === 'email' ? '邮箱' : '手机'}验证码`} />
                      <button type="button" onClick={handleSendCode} disabled={countdown > 0} className={`absolute right-2 py-2 px-3 text-xs font-bold rounded-lg ${countdown > 0 ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100'}`}>
                        {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button type="submit" disabled={isAuthenticating || (!isLoginMode && password !== confirmPassword)} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-0.5">
                  {isAuthenticating ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{isLoginMode ? '安全登入' : '提交注册并分配 UID'}</span>}
                </button>
              </form>

              <div className="text-center mt-6">
                <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 underline decoration-2 underline-offset-4">{isLoginMode ? '新用户？点此极速注册' : '已有账号？点此直接登录'}</button>
              </div>
              
              <div className="relative flex items-center py-7"><div className="flex-grow border-t border-slate-100"></div><span className="mx-4 text-slate-300 text-[10px] font-bold uppercase tracking-widest">快速体验通道</span><div className="flex-grow border-t border-slate-100"></div></div>
              <button onClick={handleGuestAuth} className="w-full bg-white border-2 border-slate-200 hover:border-indigo-400 text-slate-600 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all"><UserCircle size={20} /> 免注册匿名体验 (数据即焚)</button>
            </div>
          </div>
        </div>
      )}

      {/* --- 工作台层 --- */}
      {appPhase === 'dashboard' && (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans">
          <div className="w-full max-w-5xl flex justify-end mb-6">
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-5 py-2.5 flex items-center gap-5 animate-fade-in">
              <div className="flex items-center gap-3 border-r border-slate-100 pr-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">{userProfile?.nickname?.charAt(0) || 'U'}</div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-800 leading-tight">{userProfile?.nickname || '加载中...'}</span>
                  {userProfile?.shortId && <span className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-50 px-1.5 rounded font-bold tracking-tighter">#{userProfile.shortId}</span>}
                </div>
              </div>
              <button onClick={handleLogout} className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5"><LogOut size={16}/> 退出</button>
            </div>
          </div>
          <div className="max-w-3xl w-full">
            <div className="mb-10 text-center animate-slide-up">
              <h1 className="text-3xl font-black text-slate-800 mb-2">个人数字资产工作台</h1>
              <p className="text-slate-500 font-medium">请上传聊天截图素材，AI 将自动分析其打字韵律与性格</p>
            </div>
            {savedPersonas.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8 animate-fade-in">
                <div className="p-6 bg-slate-50/50 flex justify-between items-center border-b border-slate-100">
                  <h2 className="font-black text-slate-800 flex items-center gap-2"><Database size={20} className="text-indigo-600" /> 已存数字人格</h2>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedPersonas.map(p => (
                    <div key={p.id} onClick={() => loadPersonaAndChat(p)} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors"><UserCircle size={24}/></div>
                        <div className="flex flex-col truncate max-w-[120px]"><span className="font-bold text-slate-800 truncate">{p.name}</span><span className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</span></div>
                      </div>
                      <button onClick={(e) => {e.stopPropagation(); handleDeleteSavedPersona(e, p.id);}} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-slide-up">
              <div className="p-10 border-b border-slate-100 text-center">
                <h2 className="text-xl font-black text-slate-800 mb-6">注入性格素材</h2>
                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.jpg,.jpeg,.png" />
                <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer ${uploadedFiles.length > 0 ? 'bg-indigo-50 border-indigo-400' : 'bg-slate-50 border-slate-300 hover:border-indigo-400'}`}>
                  {uploadedFiles.length > 0 ? (
                    <div className="flex flex-col items-center gap-4">
                      <CheckSquare size={48} className="text-indigo-600" />
                      <div className="flex flex-wrap justify-center gap-2">{uploadedFiles.map((f, i) => <span key={i} className="px-3 py-1 bg-white rounded-lg text-xs font-bold border border-indigo-100 shadow-sm">{f.name}</span>)}</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-slate-400">
                      <UploadCloud size={56} className="text-slate-300" />
                      <p className="font-bold text-slate-600">点击上传截图或 TXT 文档</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-8 bg-slate-50">
                <button onClick={handleStartDistillation} disabled={uploadedFiles.length === 0} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-1 disabled:opacity-50">开始蒸馏性格特征</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 蒸馏及对话层 --- */}
      {appPhase === 'distilling' && (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-mono">
          <div className="max-w-xl w-full">
            <div className="flex items-center gap-3 mb-6"><Loader2 className="animate-spin text-indigo-400" size={32}/><h1 className="text-2xl font-bold text-white tracking-widest">DISTILLING...</h1></div>
            <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-8 h-[400px] flex flex-col">
              <div className="h-1 bg-slate-700 w-full mb-6 rounded-full"><div className="h-full bg-indigo-500 transition-all duration-500" style={{width:`${distillProgress}%`}}></div></div>
              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                {distillLogs.map((l, i) => <div key={i} className={`text-sm ${l.includes('成功') ? 'text-green-400 font-bold' : 'text-slate-400'}`}>[{new Date().toLocaleTimeString()}] {l}</div>)}
                <div ref={terminalEndRef}/>
              </div>
            </div>
          </div>
        </div>
      )}

      {appPhase === 'chat' && (
        <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden">
          <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shadow-sm z-10">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-50 p-3 rounded-2xl"><UserCircle className="text-indigo-600" size={28}/></div>
              <div><h1 className="text-xl font-black text-slate-800 tracking-tight">数字分身</h1><p className="text-xs font-bold text-emerald-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 在线</p></div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleExtractTasks} className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-100 transition-all flex items-center gap-2"><Sparkles size={16}/> 智能代办</button>
              <button onClick={() => setAppPhase('dashboard')} className="px-5 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-100 transition-all">返回大厅</button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-8 space-y-6">
            {messages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[75%] px-6 py-4 rounded-3xl shadow-sm text-sm font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>
                  {m.role === 'assistant' && m.isAnimated ? (
                    <SimulatedTypingText content={m.text} persona={activePersona} scrollRef={messagesEndRef} onComplete={() => setMessages(p => p.map(msg => msg.id === m.id ? { ...msg, isAnimated: false } : msg))} />
                  ) : (m.text.replace(/<del>.*?<\/del>/g, ''))}
                  <span className={`block text-[10px] mt-2 font-black opacity-50 ${m.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}`}>{m.time}</span>
                </div>
              </div>
            ))}
            {isTypingIndicator && <div className="flex gap-2 p-4 bg-white rounded-2xl w-fit"><div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div><div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></div></div>}
            <div ref={messagesEndRef} className="h-4"/>
          </main>
          <footer className="bg-white border-t border-slate-200 p-6">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-4">
              <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="与分身深入交流..." className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" />
              <button type="submit" disabled={!input.trim()} className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all"><Send/></button>
            </form>
          </footer>

          {showTasksModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><CheckSquare className="text-indigo-600"/> 提炼代办事项</h2>
                <div className="space-y-3 mb-8 max-h-60 overflow-y-auto">
                  {extractedTasks.length === 0 ? <p className="text-center text-slate-400 py-10 font-bold">未识别到明确任务</p> : 
                    extractedTasks.map((t, i) => <label key={i} className="flex gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100"><input type="checkbox" className="w-4 h-4 mt-1"/><span className="text-sm font-bold text-slate-700">{t}</span></label>)
                  }
                </div>
                <button onClick={() => setShowTasksModal(false)} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl">关闭</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
