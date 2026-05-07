import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flower2, Plus, X, Calendar, User, Heart, Image as ImageIcon, Flame, LogOut, LogIn, CheckCircle, Clock, QrCode, MapPin, Shield, MessageCircle, Send, Trash2 } from 'lucide-react';
import { format, formatDistanceToNow, isWithinInterval, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';

// Types
interface AppUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
}

interface Comment {
  id: string;
  memorial_id: string;
  user_id: string;
  content: string;
  created_at: any;
  user_name: string;
}

interface Message {
  id: string;
  memorial_id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  created_at: any;
}

interface ForumPost {
  id: string;
  user_id: string;
  content: string;
  created_at: any;
  user_name: string;
  user_role: 'user' | 'admin';
  user_avatar?: string;
  flowers?: string[];
  image_url?: string;
  forum_comments?: { user_id: string; user_name: string; content: string; created_at: any }[];
}

interface Memorial {
  id: string;
  name?: string;
  birth_date?: string;
  death_date?: string;
  message: string;
  image_url?: string;
  author_name?: string;
  author_id: string;
  created_at: any;
  type: 'person' | 'festival';
  event_date?: string;
  status: 'pending_payment' | 'pending_order' | 'accepted' | 'in_progress' | 'pending_acceptance' | 'completed';
  location?: string;
  remarks?: string;
  completion_time?: string;
  completion_location?: string;
  completion_images?: string | string[];
  completion_remarks?: string;
  progress_images?: string[];
  comments?: Comment[];
}

const normalizeImageUrls = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((url): url is string => typeof url === 'string' && url.length > 0);
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((url): url is string => typeof url === 'string' && url.length > 0);
  } catch {
    // Plain URL from older data.
  }
  return [value];
};

const assetKeyFromUrl = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    const prefix = '/api/assets/';
    if (!parsed.pathname.startsWith(prefix)) return '';
    return decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    return '';
  }
};

const isQingmingPeriod = () => {
  const now = new Date();
  const year = now.getFullYear();
  const qingming = new Date(year, 3, 5);
  const start = new Date(year, 3, 5);
  start.setDate(qingming.getDate() - 15);

  return isWithinInterval(now, {
    start: startOfDay(start),
    end: endOfDay(qingming)
  });
};


const UserProfileSettings = ({ currentUser, setCurrentUser, setRefreshTrigger }: any) => {
  const [name, setName] = React.useState(currentUser?.name || '');
  const [avatar, setAvatar] = React.useState(currentUser?.avatar || '');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    setMessage('');
    try {
      const updateData = { name: name.trim(), avatar: avatar.trim() };
      await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
setRefreshTrigger(prev => prev + 1);
      setCurrentUser((prev: any) => ({ ...prev, ...updateData }));
      setMessage('保存成功！');
    } catch (e: any) {
      console.error(e);
      setMessage('保存失败: ' + (e.message || e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 space-y-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-[#5A5A40]/10 flex items-center justify-center overflow-hidden border-2 border-[#5A5A40]/20 shadow-md">
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-10 h-10 text-[#5A5A40]" />
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#5A5A40] mb-1.5 ml-1">昵称</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 transition-all placeholder-[#2c2c2c]/30"
            placeholder="请输入您的昵称"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#5A5A40] mb-1.5 ml-1">头像图片地址 (URL)</label>
          <div className="flex gap-2 items-center">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('file', file);
                setIsSubmitting(true);
                try {
                  const res = await fetch('/api/upload', { method: 'POST', body: formData }).then(r => r.json());
                  if (res.url) setAvatar(res.url);
                } catch (err) {
                  setMessage('上传失败');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 transition-all placeholder-[#2c2c2c]/30"
            />
          </div>
        </div>
      </div>

      {message && (
        <p className={`text-center text-xs font-medium ${message.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{message}</p>
      )}

      <button
        onClick={handleSave}
        disabled={isSubmitting}
        className="w-full bg-[#5A5A40] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg hover:bg-[#4a4a35] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
        保存个人资料
      </button>
    </div>
  );
};

const TAOIST_KNOWLEDGE = [
  "道教的祭祀活动统称为“斋醮”（zhāi jiào）。",
  "“斋”指洁净身心，“醮”指祭神祈福。",
  "斋醮科仪是道教所有道场法事的总称。",
  "道教祭祀的核心理念是“天人感应”。",
  "法事主要分为“阳事”（祈福消灾）和“阴事”（超度亡灵）。",
  "主持斋醮核心环节的法师称为“高功”，通常需经过受箓。",
  "祭祀不仅是为了敬神祈福，也是道士自身修行的一部分。",
  "道教认为万物有灵，因此祭祀对象不仅有神仙，还包括自然星宿。",
  "心诚则灵是道教祭祀最根本的要求。",
  "大型祭祀活动不仅为个人，更旨在祈求国泰民安、风调雨顺。",
  "祭祀的场地称为“坛”或“道场”。",
  "建坛需要严格按照八卦、五行的方位来布置。",
  "坛场内必须悬挂或张贴神像、牌位（神位）。",
  "正式做法事进坛前，必须先进行“净坛”仪式。",
  "坛场布置严禁任何污秽、不洁之物入内。",
  "道教最高信仰神为“三清”（元始天尊、灵宝天尊、道德天尊）。",
  "“四御”是辅佐三清的四位天帝，也是重要祭祀对象。",
  "祭祀太岁神（拜太岁）多用于祈求流年平安、化解不顺。",
  "祭祀财神（如赵公明元帅）的高峰通常在正月初五。",
  "祭祀灶神（司命真君）通常在农历腊月二十三或二十四。",
  "最基础的供品为“五供”：香、花、灯、水、果。",
  "烧香被视为人与神明沟通的媒介（心假香传）。",
  "敬神通常上三炷香，代表敬奉道教“三宝”（道、经、师）或“三清”。",
  "上香时以左手插香为敬（左手在道教被视为净手）。",
  "供水代表清净无染，多使用干净的清水或井水。",
  "供花以清香带根者为佳，忌用带刺或气味浓烈刺鼻的花。",
  "供果多用苹果、橘子等，寓意平平安安、大吉大利。",
  "忌供石榴（多籽秽浊）、李子（避讳太上老君姓李）和黑枣。",
  "供奉神明的茶通常为三杯。",
  "道教祭祀严忌“四不吃”：牛肉、狗肉、乌鱼、鸿雁。",
  "全真派供奉神明纯用素食，正一派部分法事可酌情用三牲，但主神仍以素供为主。",
  "供灯代表破除黑暗的“光明”和“智慧”。",
  "供品讲究新鲜、洁净，不可用已食用过的残羹冷炙。",
  "祭祀完毕后的供品分给众人食用，称为“散福”。",
  "但祭祀过亡灵（阴事）的供品，一般不建议活人食用。",
  "供奉的面食常被制成馒头、寿桃等象征吉祥的形状。",
  "上供品时需双手捧举，齐眉为敬。",
  "撤供必须在法事完全结束、神明“退班”后进行。",
  "绝对不可以用嘴去吹灭供坛上的油灯或蜡烛。",
  "劣质香、断香不可用于祭祀神明。",
  "法器是法师作法、降妖除魔的重要工具。",
  "令牌象征神明权威，用于召神遣将。",
  "法印类似于人间的官印，用于印发符箓、通达神明。",
  "镇坛木（类似惊堂木）用于拍击桌面，威慑邪魅。",
  "宝剑（如桃木剑、七星剑）用于做法时斩妖除魔。",
  "朝简（笏板）是高功法师朝拜神明时双手捧持的奏板。",
  "三清铃（帝钟）法师摇动以振动法界、迎请神明。",
  "木鱼用于诵经时敲击，掌握节奏，使众人整齐划一。",
  "磬的发声清越幽远，代表肃穆，常与木鱼配合。",
  "疏文是凡人向神明上奏的书信（祈福文书）。",
  "疏文通常用黄纸或红纸书写，格式极其严格。",
  "将疏文在法事中焚化的过程称为“进表”或“化疏”。",
  "符箓是用朱砂画在黄纸上的神符，是调动神力的凭信。",
  "画符必须配合念咒和步罡，否则只是空纸一张。",
  "凡人或信众不可随意触碰、跨越法师的法器。",
  "道教叩拜行“太极印”（左手抱右手，抱拳结印）。",
  "叩头讲究头伏于手背上，不叩响头（不发出砰砰声）。",
  "三跪九叩是道教祭祀中最高级别的礼节。",
  "步罡踏斗是高功法师效仿星辰运转在坛场上的步伐。",
  "禹步是步罡中最基础、最古老的步法。",
  "诵经是祭祀的核心环节，通过念诵经文积累功德。",
  "念咒（真言）常配合手诀，用于驱邪、治病或请神。",
  "掐诀（捏诀）是法师手指结成特定形状，用于沟通法界。",
  "存想（观想）是法师在内心中想象神明降临的过程。",
  "洒净仪式通常用杨柳枝蘸取净水，洒向四方除秽。",
  "道教的祭祀音乐被称为“道场赞韵”或“仙音”。",
  "绕坛是法师带领信众绕行神坛，以示尊崇。",
  "开光是为新塑神像注入神灵之气的重要仪式。",
  "施食（放口焰）是阴事法事中超度、赈济饿鬼的科仪。",
  "过火或“跨火盆”是某些地方道教净化身心的仪式。",
  "参加祭祀需衣冠整齐，忌穿短裤、拖鞋、背心入殿。",
  "祭祀前一天最好沐浴更衣，忌食葱、蒜、韭菜等荤辛之物。",
  "经期妇女、刚喝过酒的人或正在服丧之人，一般忌入坛场。",
  "大殿内绝对不可大声喧哗，不可用手指对神像指指点点。",
  "离开大殿时，视情况可先退半步再转身，以示敬意。",
  "进殿讲究“左脚先跨左门，右脚先跨右门”。",
  "进出殿门时，严禁踩踏门槛。",
  "祭祀时，不可从正在跪地叩拜的人正前方越过。",
  "烧纸钱（元宝）必须在道观指定的焚化炉中进行。",
  "纸钱必须彻底烧尽化为灰烬，道教认为这样才能送达无形界。",
  "法师做法时，信众应肃立静听，不可随意走动或闲聊。",
  "未经道长允许，信众不可随意翻阅神案上的道教经书。",
  "经书不可放在床榻、座椅或任何不洁之处。",
  "与道长打招呼行礼，可称呼“慈悲”、“道长”或“爷”。",
  "见面行礼多使用拱手礼（抱拳礼）。",
  "道教祭祀非常讲究择吉日良辰。",
  "朔望日（农历初一、十五）是最常规的入庙祭祀日。",
  "“三元节”是道教最重要的三大祭祀节日。",
  "上元节（正月十五）祭祀天官，主祈福。",
  "中元节（七月十五）祭祀地官，主赦罪、超度亡魂。",
  "下元节（十月十五）祭祀水官，主解厄。",
  "冬至不仅是节气，也是道教祭祀元始天尊的重要日子。",
  "神仙祖师的圣诞日（如老子诞辰、吕祖诞辰）会举行隆重祭祀。",
  "戊日（按干支纪日带有“戊”字的日子）是道教的禁忌日。",
  "戊日不可动土、不可诵经、不可做法事，称为“避戊”。",
  "子时（夜11点-凌晨1点）是阴阳交替之时，常用于起坛请神。",
  "祭祀法事短则一两个小时，长则可达数天数夜。",
  "罗天大醮是道教最高级别、规模最大的祭祀大典。",
  "春节期间的“拜太岁”法事通常在立春之后进行。",
  "任何祭祀仪式终究是外在形式，修善积德才是获得神明护佑的根本。"
];

export default function App() {
  const [isQingming, setIsQingming] = useState(isQingmingPeriod());
  const [knowledgeIndex, setKnowledgeIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setKnowledgeIndex(prev => (prev + 1) % TAOIST_KNOWLEDGE.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const [memorials, setMemorials] = useState<Memorial[]>([]);
  const [userMemorials, setUserMemorials] = useState<Memorial[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [adminMemorials, setAdminMemorials] = useState<Memorial[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [forumInput, setForumInput] = useState('');
  const [isForumSubmitting, setIsForumSubmitting] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [pendingDeletePostId, setPendingDeletePostId] = useState<string | null>(null);
  const [pendingAcceptId, setPendingAcceptId] = useState<string | null>(null);
  const [forumCommentInput, setForumCommentInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Auth state
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Auth Form State - User
  const [userAuthMode, setUserAuthMode] = useState<'login' | 'register'>('login');
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userAuthError, setUserAuthError] = useState('');
  const [isUserSubmitting, setIsUserSubmitting] = useState(false);

  // Auth Form State - Admin
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Payment state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingMemorialId, setPendingMemorialId] = useState<string | null>(null);

  // Chat state
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [currentChatMemorial, setCurrentChatMemorial] = useState<Memorial | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Inline chat inside profile modal
  const [inlineChatMemorial, setInlineChatMemorial] = useState<Memorial | null>(null);
  const [inlineChatMessages, setInlineChatMessages] = useState<Message[]>([]);
  const [inlineChatInput, setInlineChatInput] = useState('');
  const inlineChatEndRef = useRef<HTMLDivElement>(null);

  // Complete state
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeData, setCompleteData] = useState({ time: '', location: '', images: [] as string[], remarks: '' });
  const [isCompletionUploading, setIsCompletionUploading] = useState(false);
  const [progressUploadingId, setProgressUploadingId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);
  const [mobileSection, setMobileSection] = useState<'forum' | 'chat'>('forum');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Forms state
  const [festivalName, setFestivalName] = useState('');
  const [festivalEventDate, setFestivalEventDate] = useState('');
  const [festivalMessage, setFestivalMessage] = useState('');
  const [festivalImageUrl, setFestivalImageUrl] = useState('');
  const [festivalPlan, setFestivalPlan] = useState<50 | 500 | 2000>(50);
  const [festivalRemarks, setFestivalRemarks] = useState('');
  const [isFestivalSubmitting, setIsFestivalSubmitting] = useState(false);

  const [personName, setPersonName] = useState('');
  const [personRelation, setPersonRelation] = useState('');
  const [personBirthDate, setPersonBirthDate] = useState('');
  const [personDeathDate, setPersonDeathDate] = useState('');
  const [personMessage, setPersonMessage] = useState('');
  const [personImageUrl, setPersonImageUrl] = useState('');
  const [isPersonSubmitting, setIsPersonSubmitting] = useState(false);

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUserRecordsModalOpen, setIsUserRecordsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishType, setPublishType] = useState<'person' | 'festival'>('person');
  const [adminFilter, setAdminFilter] = useState<'all' | 'pending_payment' | 'pending_order' | 'accepted' | 'in_progress' | 'pending_acceptance' | 'completed'>('all');

  // AI Chat state
  const [aiCharacter, setAiCharacter] = useState<Memorial | null>(null);
  const [aiMessages, setAiMessages] = useState<{ id: string, role: 'user' | 'ai', content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const aiMessagesEndRef = useRef<HTMLDivElement>(null);

  // Comments state
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setIsQingming(isQingmingPeriod()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const data = await response.json();
        setCurrentUser(data.user);
      } catch (e) {
        console.error("Auth init error:", e);
        setCurrentUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      try {
        // Forum posts
        const forumRes = await fetch('/api/forum_posts').then(r => r.json());
        setForumPosts((forumRes || []).map((doc: any) => ({ ...doc, id: doc._id || doc.id } as ForumPost)));

        // Public memorials
        const memRes = await fetch('/api/memorials?status=accepted,completed').then(r => r.json());
        setMemorials((memRes || []).map((doc: any) => ({ ...doc, id: doc._id || doc.id } as Memorial)));
        setIsLoading(false);

        // User memorials
        const userMemRes = await fetch(`/api/memorials?author_id=${currentUser.id}`).then(r => r.json());
        setUserMemorials((userMemRes || []).map((doc: any) => ({ ...doc, id: doc._id || doc.id } as Memorial)));

        // Admin memorials
        if (currentUser.role === 'admin') {
          const adminMemRes = await fetch('/api/memorials').then(r => r.json());
          setAdminMemorials((adminMemRes || []).map((doc: any) => ({ ...doc, id: doc._id || doc.id } as Memorial)));
        }

        // Comments
        const commentsRes = await fetch('/api/comments').then(r=>r.json());
        const commentsByMemorial: Record<string, Comment[]> = {};
        (commentsRes || []).forEach((doc: any) => {
          const data = { ...doc, id: doc._id || doc.id } as Comment;
          if (!commentsByMemorial[data.memorial_id]) commentsByMemorial[data.memorial_id] = [];
          commentsByMemorial[data.memorial_id].push(data);
        });
        Object.keys(commentsByMemorial).forEach(k => {
          commentsByMemorial[k].sort((a, b) => {
            const timeA = new Date(a.created_at).getTime() || 0;
            const timeB = new Date(b.created_at).getTime() || 0;
            return timeA - timeB;
          });
        });
        setMemorials(prev => prev.map(m => ({ ...m, comments: commentsByMemorial[m.id] || [] })));
        setUserMemorials(prev => prev.map(m => ({ ...m, comments: commentsByMemorial[m.id] || [] })));
        setAdminMemorials(prev => prev.map(m => ({ ...m, comments: commentsByMemorial[m.id] || [] })));
      } catch (err) {
        console.error('数据加载失败:', err);
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // 每10秒刷新一次
    return () => clearInterval(interval);
  }, [currentUser, refreshTrigger]);

  useEffect(() => {
    if (chatModalOpen && currentChatMemorial) {
      const fetchMessages = async () => {
        try {
          const res = await fetch(`/api/messages?memorial_id=${currentChatMemorial.id}`).then(r => r.json());
          setMessages((res || []).map((doc: any) => ({ ...doc, id: doc._id || doc.id } as Message)));
        } catch (err) {
          console.error('加载消息失败:', err);
        }
      };
      fetchMessages();
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [chatModalOpen, currentChatMemorial]);

  // Inline chat polling
  useEffect(() => {
    if (inlineChatMemorial) {
      const fetchInlineMessages = async () => {
        try {
          const res = await fetch(`/api/messages?memorial_id=${inlineChatMemorial.id}`).then(r => r.json());
          setInlineChatMessages((res || []).map((doc: any) => ({ ...doc, id: doc._id || doc.id } as Message)));
        } catch (err) {
          console.error('加载内联消息失败:', err);
        }
      };
      fetchInlineMessages();
      const interval = setInterval(fetchInlineMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [inlineChatMemorial]);

  useEffect(() => {
    inlineChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [inlineChatMessages]);

  useEffect(() => {
    if (aiMessagesEndRef.current) aiMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, isAiTyping]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!imagePreview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImagePreview(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imagePreview]);

  const uploadLocalImages = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (selectedFiles.length === 0) return [];

    return Promise.all(selectedFiles.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(data.error || `${file.name} 上传失败`);
      }
      return data.url as string;
    }));
  };

  const deleteUploadedAsset = async (url: string) => {
    const key = assetKeyFromUrl(url);
    if (!key) return;
    const response = await fetch(`/api/assets/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error('照片文件清理失败');
    }
  };

  const handleDeleteProgressImage = async (memorial: Memorial, imageIndex: number) => {
    if (!confirm('确定删除这张进度照片吗？')) return;
    try {
      const existing = normalizeImageUrls(memorial.progress_images);
      const deletedUrl = existing[imageIndex];
      const nextImages = existing.filter((_, index) => index !== imageIndex);
      const response = await fetch(`/api/memorials/${memorial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress_images: nextImages })
      });
      if (!response.ok) throw new Error('进度照片删除失败');
      if (deletedUrl) {
        try {
          await deleteUploadedAsset(deletedUrl);
        } catch (cleanupError) {
          console.warn('Progress image removed from order, but asset cleanup failed:', cleanupError);
        }
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Delete progress image failed:', error);
      alert(error.message || '进度照片删除失败');
    }
  };

  const handleAuthSubmit = async (
    e: React.FormEvent,
    role: 'user' | 'admin',
    mode: 'login' | 'register',
    uName: string,
    uPass: string,
    setError: (msg: string) => void,
    setSubmitting: (val: boolean) => void
  ) => {
    e.preventDefault();
    if (!uName.trim() || !uPass.trim()) {
      setError('请输入账号和密码');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: uName.trim(),
          password: uPass,
          role
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || (mode === 'login' ? '登录失败，请检查账号和密码' : '注册失败，请重试'));
        setSubmitting(false);
        return;
      }

      setCurrentUser(data.user);
    } catch (error: any) {
      console.error('Auth error:', error);
      setError(mode === 'login' ? '登录失败，请重试' : '注册失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setCurrentUser(null);
  };

  const handleForumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forumInput.trim() || !currentUser) return;

    setIsForumSubmitting(true);
    try {
      await fetch('/api/forum_posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: uuidv4(),
          user_id: currentUser.id,
          content: forumInput.trim(),
          created_at: new Date().toISOString(),
          user_name: currentUser.name,
          user_role: currentUser.role,
          user_avatar: currentUser.avatar || ''
        })
      });
      setForumInput('');
    } catch (error) {
      console.error('Failed to post to forum:', error);
    } finally {
      setIsForumSubmitting(false);
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || !aiCharacter) return;

    const newUserMsg = { id: Date.now().toString(), role: 'user' as const, content: aiInput.trim() };
    setAiMessages(prev => [...prev, newUserMsg]);
    setAiInput('');
    setIsAiTyping(true);

    const charName = aiCharacter.name || '亲人';
    const charMsg = aiCharacter.message || '';
    const birthDate = aiCharacter.birth_date || '';
    const deathDate = aiCharacter.death_date || '';
    const dateInfo = birthDate || deathDate ? `（${birthDate ? '生于' + birthDate : ''}${birthDate && deathDate ? '，' : ''}${deathDate ? '离世于' + deathDate : ''}）` : '';

    try {
      const allMessages = [...aiMessages, newUserMsg];
      const charRelation = (aiCharacter as any).relation || '';
      const relationInfo = charRelation ? `你是用户的${charRelation}。` : '';
      const systemPrompt = `你现在扮演的是一位已故亲人，名叫「${charName}」${dateInfo}。${relationInfo}
以下是家人对你的追思和回忆：
${charMsg}

请以${charName}的第一人称角度回复，语气符合一位${charRelation || '长辈'}的身份。语气要温柔、慈爱、平和。
不要反复提及“我已经离开”或“我在天堂”等话，而是像一位${charRelation || '亲人'}一样自然地关心家人、回忆往事、表达爱意。
回复要简洁温暖（1-3句），使用中文。`;
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'Qwen/Qwen2.5-7B-Instruct',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            ...allMessages.map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content
            }))
          ],
          max_tokens: 512,
          temperature: 0.7
        })
      });

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content || '抱歉，我没能理解您的意思。';
      setAiMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: aiText }]);
    } catch (error) {
      console.error("AI Chat Error:", error);
      setAiMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: '抱歉，我暂时无法回应，请稍后再试。' }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handlePersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsPersonSubmitting(true);

    try {
      const response = await fetch('/api/memorials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        name: personName,
        relation: personRelation,
        birth_date: personBirthDate,
        death_date: personDeathDate,
        message: personMessage,
        image_url: personImageUrl,
        author_name: currentUser.name,
        author_id: currentUser.id,
        created_at: new Date().toISOString(),
        type: 'person',
        status: isQingming ? 'pending_payment' : 'accepted'
      })
      });
      if (!response.ok) throw new Error('发布失败');
      const docRef = await response.json();

      setPersonMessage(''); setPersonImageUrl(''); setPersonName(''); setPersonRelation(''); setPersonBirthDate(''); setPersonDeathDate('');
      setIsPublishModalOpen(false);
      setRefreshTrigger(prev => prev + 1);

      if (isQingming) {
        setPendingMemorialId(docRef.id);
        setPaymentModalOpen(true);
      }
    } catch (error) {
      console.error(error);
      alert('发布失败，请重试');
    } finally {
      setIsPersonSubmitting(false);
    }
  };

  const handleFestivalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsFestivalSubmitting(true);

    try {
      const response = await fetch('/api/memorials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        name: festivalName,
        event_date: festivalEventDate,
        message: festivalMessage,
        image_url: festivalImageUrl,
        plan: festivalPlan,
        remarks: festivalRemarks,
        author_name: currentUser.name,
        author_id: currentUser.id,
        created_at: new Date().toISOString(),
        type: 'festival',
        status: 'pending_payment'
      })
      });
      if (!response.ok) throw new Error('提交失败');
      const docRef = await response.json();

      setFestivalMessage(''); setFestivalImageUrl(''); setFestivalName(''); setFestivalEventDate(''); setFestivalPlan(50); setFestivalRemarks('');
      setIsPublishModalOpen(false);
      setRefreshTrigger(prev => prev + 1);

      setPendingMemorialId(docRef.id);
      setPaymentModalOpen(true);
    } catch (error) {
      console.error(error);
      alert('发布失败，请重试');
    } finally {
      setIsFestivalSubmitting(false);
    }
  };

  const handleCommentSubmit = async (memorialId: string) => {
    const content = commentInputs[memorialId];
    if (!content || !content.trim() || !currentUser) return;

    setSubmittingCommentId(memorialId);
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: uuidv4(),
          memorial_id: memorialId,
          user_id: currentUser.id,
          content: content.trim(),
          created_at: new Date().toISOString(),
          user_name: currentUser.name
        })
      });
      setCommentInputs(prev => ({ ...prev, [memorialId]: '' }));
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setSubmittingCommentId(null);
    }
  };

  const handlePaymentComplete = async () => {
    if (!pendingMemorialId) return;
    try {
      await fetch(`/api/memorials/${pendingMemorialId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending_order' })
      });
setRefreshTrigger(prev => prev + 1);
      setPaymentModalOpen(false);
      setPendingMemorialId(null);
      alert('支付已提交，等待管理员接单发布！');
    } catch (error) {
      console.error('Payment failed:', error);
    }
  };

  const handleAcceptOrder = async (id: string) => {
    try {
      await fetch(`/api/memorials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' })
      });
setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Accept failed:', error);
    }
  };

  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingMemorialId || isCompletionUploading) return;
    try {
      await fetch(`/api/memorials/${pendingMemorialId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        status: 'completed',
        completion_time: completeData.time,
        completion_location: completeData.location,
        completion_images: completeData.images,
        completion_remarks: completeData.remarks
      })
      });
setRefreshTrigger(prev => prev + 1);
      setCompleteModalOpen(false);
      setPendingMemorialId(null);
      setCompleteData({ time: '', location: '', images: [], remarks: '' });
    } catch (error) {
      console.error('Complete failed:', error);
    }
  };

  const openChat = (memorial: Memorial) => {
    setCurrentChatMemorial(memorial);
    setChatModalOpen(true);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChatMemorial || !currentUser) return;

    try {
      await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: uuidv4(), 
        memorial_id: currentChatMemorial.id,
        sender_id: currentUser.id,
        content: newMessage.trim(),
         created_at: new Date().toISOString() }) });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要撤销这条记录吗？撤销后将无法恢复。')) return;
    try {
      await fetch(`/api/memorials/${id}`, { method: 'DELETE' });
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('撤销失败');
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    let tsStr = timestamp;
    if (typeof tsStr === 'string' && !tsStr.endsWith('Z') && !tsStr.includes('+')) {
      tsStr = tsStr.replace(' ', 'T') + 'Z';
    }
    const date = timestamp.toDate ? timestamp.toDate() : new Date(tsStr);
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
  };

  if (isCheckingAuth) {
    return (
      <motion.div
        key="loading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-[#f5f5f0] flex items-center justify-center"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5A5A40]"></div>
      </motion.div>
    );
  }

  if (!currentUser) {
    return (
      <motion.div
        key="login"
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="min-h-screen font-sans text-[#2c2c2c] flex flex-col items-center justify-center relative bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url('/cover-bg.jpg')` }}
      >
        <div className="absolute inset-0 bg-[#f5f5f0]/85 backdrop-blur-xl transition-colors duration-1000" />

        <div className="relative z-10 w-full max-w-6xl px-4 py-4 flex flex-col items-center justify-between h-screen">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-4 shrink-0">
            <div className="w-14 h-14 rounded-full bg-[#5A5A40]/10 backdrop-blur-md flex items-center justify-center mb-3 border border-[#5A5A40]/20 shadow-lg">
              <Flower2 className="w-7 h-7 text-[#5A5A40]" />
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold mb-1 tracking-wide text-[#5A5A40]">云端追思</h1>
            <p className="text-[#5A5A40]/70 text-xs font-medium tracking-wider">跨越时空，寄托哀思</p>
          </motion.div>

          {/* Login Forms Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl mb-5 shrink-0">

            {/* User Form */}
            <motion.form
              initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              onSubmit={(e) => handleAuthSubmit(e, 'user', userAuthMode, userUsername, userPassword, setUserAuthError, setIsUserSubmitting)}
              className="w-full bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:bg-white/80 transition-all"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#5A5A40]/80 to-[#8a8a60]/80 transform origin-left transition-transform duration-500 group-hover:scale-x-100" />
              <h2 className="text-lg font-serif font-bold text-center text-[#5A5A40] mb-1">
                用户通道
              </h2>
              <p className="text-[#5A5A40]/60 text-[11px] text-center mb-4">{userAuthMode === 'login' ? '欢迎回来，缅怀故人' : '注册新账号，开启云端追思'}</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#5A5A40]/80 mb-1">用户账号</label>
                  <input
                    type="text"
                    value={userUsername}
                    onChange={(e) => setUserUsername(e.target.value)}
                    placeholder="请输入账号"
                    className="w-full bg-white/80 border border-[#5A5A40]/20 rounded-lg px-3 py-2.5 text-sm text-[#2c2c2c] placeholder-[#2c2c2c]/30 focus:ring-2 focus:ring-[#5A5A40]/40 outline-none transition-all shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5A5A40]/80 mb-1">密码</label>
                  <input
                    type="password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full bg-white/80 border border-[#5A5A40]/20 rounded-lg px-3 py-2.5 text-sm text-[#2c2c2c] placeholder-[#2c2c2c]/30 focus:ring-2 focus:ring-[#5A5A40]/40 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {userAuthError && (
                <p className="text-red-500 bg-red-50 rounded-lg py-1.5 text-xs mt-3 text-center border border-red-100 font-medium">{userAuthError}</p>
              )}

              <button
                type="submit"
                disabled={isUserSubmitting}
                className="w-full bg-[#5A5A40] hover:bg-[#4a4a35] text-white py-2.5 rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 active:scale-95"
              >
                {isUserSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <User className="w-4 h-4" />
                )}
                {userAuthMode === 'login' ? '登录进入' : '注册并进入'}
              </button>

              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setUserAuthMode(userAuthMode === 'login' ? 'register' : 'login');
                    setUserAuthError('');
                  }}
                  className="text-xs text-[#5A5A40]/70 font-bold hover:text-[#5A5A40] transition-colors border-b border-[#5A5A40]/30 pb-0.5"
                >
                  {userAuthMode === 'login' ? '没有账号？点击注册' : '已有账号？点击登录'}
                </button>
              </div>
            </motion.form>

            {/* Admin Form */}
            <motion.form
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              onSubmit={(e) => handleAuthSubmit(e, 'admin', 'login', adminUsername, adminPassword, setAdminAuthError, setIsAdminSubmitting)}
              className="w-full bg-slate-50/60 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:bg-slate-50/90 transition-all"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-500/80 to-slate-400/80 transform origin-left transition-transform duration-500 group-hover:scale-x-100" />
              <h2 className="text-lg font-serif font-bold text-center text-slate-700 mb-1 flex items-center justify-center gap-2">
                <Shield className="w-5 h-5 text-slate-500" /> 管理员通道
              </h2>
              <p className="text-slate-500/60 text-[11px] text-center mb-4">仅限系统管理员登录，负责平台运营</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700/80 mb-1">管理账号</label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="请输入管理账号"
                    className="w-full bg-white/90 border border-slate-200/80 rounded-lg px-3 py-2.5 text-sm text-[#2c2c2c] placeholder-[#2c2c2c]/30 focus:ring-2 focus:ring-slate-400/50 outline-none transition-all shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700/80 mb-1">安全密码</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="请输入管理密码"
                    className="w-full bg-white/90 border border-slate-200/80 rounded-lg px-3 py-2.5 text-sm text-[#2c2c2c] placeholder-[#2c2c2c]/30 focus:ring-2 focus:ring-slate-400/50 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {adminAuthError && (
                <p className="text-red-500 bg-red-50 rounded-lg py-1.5 text-xs mt-3 text-center border border-red-100 font-medium">{adminAuthError}</p>
              )}

              <button
                type="submit"
                disabled={isAdminSubmitting}
                className="w-full bg-slate-700 hover:bg-slate-800 text-white py-2.5 rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 active:scale-95"
              >
                {isAdminSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                管理员安全登录
              </button>
            </motion.form>
          </div>

          {/* Feature Cards Bottom Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-6xl shrink-0 pb-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white/60 backdrop-blur-md border border-white/60 rounded-xl p-4 shadow-sm hover:bg-white/80 hover:shadow-md transition-all">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Flower2 className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-sm font-serif font-bold text-[#5A5A40]">云端追思</h3>
              </div>
              <p className="text-[#2c2c2c]/70 text-xs leading-relaxed text-justify font-medium">
                搭建线上数字化缅怀空间，提供线上献花、追思文案发布、平台缅怀交流、虚拟纪念互动等服务，打破时空限制，以轻量化、无接触、无污染的方式寄托哀思，让传统祭祀情感在数字时代温情延续。
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white/60 backdrop-blur-md border border-white/60 rounded-xl p-4 shadow-sm hover:bg-white/80 hover:shadow-md transition-all">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-serif font-bold text-[#5A5A40]">文化科普</h3>
              </div>
              <p className="text-[#2c2c2c]/70 text-xs leading-relaxed text-justify font-medium">
                普及非遗祭祀礼仪、传统岁时习俗与正统道教文化，阐明祭祀是承载敬祖尽孝的民俗仪式，而非封建迷信，引导公众正确认识、理性传承传统文化。
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white/60 backdrop-blur-md border border-white/60 rounded-xl p-4 shadow-sm hover:bg-white/80 hover:shadow-md transition-all">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-teal-600" />
                </div>
                <h3 className="text-sm font-serif font-bold text-[#5A5A40]">绿色代祭</h3>
              </div>
              <p className="text-[#2c2c2c]/70 text-xs leading-relaxed text-justify font-medium">
                在合规道观等安全肃穆场所开展规范化代祭服务，同时推广竹浆、秸秆浆等环保祭祀纸张，以低污染、低烟尘、可降解的绿色形式，实现文明、安全、有仪式感的现代祭祀。
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    );
  }

  const handleSendFlower = async (postId: string) => {
    if (!currentUser) return;
    const post = forumPosts.find(p => p.id === postId);
    if (!post) return;
    const flowers = post.flowers || [];
    const hasFlowered = flowers.includes(currentUser.id);
    try {
      if (hasFlowered) {
        await fetch(`/api/forum_posts/${postId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flowers: flowers.filter((id: string) => id !== currentUser.id) }) });
setRefreshTrigger(prev => prev + 1);
      } else {
        await fetch(`/api/forum_posts/${postId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flowers: [...flowers, currentUser.id] }) });
setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) { console.error(err); }
  };

  const handleForumComment = async (postId: string) => {
    if (!forumCommentInput.trim() || !currentUser) return;
    const post = forumPosts.find(p => p.id === postId);
    if (!post) return;
    const existing = post.forum_comments || [];
    try {
      await fetch(`/api/forum_posts/${postId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        forum_comments: [...existing, {
          user_id: currentUser.id,
          user_name: currentUser.name,
          user_avatar: currentUser.avatar || '',
          content: forumCommentInput.trim(),
          created_at: new Date().toISOString()
        }]
      }) });
setRefreshTrigger(prev => prev + 1);
      setForumCommentInput('');
      setActiveCommentPostId(null);
    } catch (err) { console.error(err); }
  };

  const renderForumPostCard = (post: ForumPost) => {
    const hasFlowered = currentUser && (post.flowers || []).includes(currentUser.id);
    const flowerCount = (post.flowers || []).length;
    const comments = post.forum_comments || [];
    const isCommenting = activeCommentPostId === post.id;
    return (
      <motion.div key={post.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 py-5 border-b border-white/20 last:border-b-0 group/post">
        <div className="w-12 h-12 rounded-xl bg-[#5A5A40]/10 flex items-center justify-center shrink-0 border border-[#5A5A40]/5 shadow-sm transition-all group-hover/post:scale-105 group-hover/post:bg-[#5A5A40]/20 overflow-hidden">
          {post.user_avatar ? <img src={post.user_avatar} alt="avatar" className="w-full h-full object-cover" /> : (post.user_role === 'admin' ? <Shield className="w-6 h-6 text-[#5A5A40]" /> : <User className="w-6 h-6 text-[#5A5A40]" />)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-bold text-[#5A5A40] text-sm tracking-wide">{post.user_name}</span>
            {post.user_role === 'admin' && (
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-md text-[10px] font-black uppercase tracking-tighter">官方</span>
            )}
          </div>
          <p className="text-[#2c2c2c] text-[15px] leading-relaxed whitespace-pre-wrap mb-3 font-medium">{post.content}</p>
          {post.image_url && (
            <div className="mb-3 rounded-2xl overflow-hidden max-w-[320px] shadow-md border border-white/40">
              <img src={post.image_url} alt="" className="w-full h-auto transition-transform hover:scale-105 duration-500" />
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-[#2c2c2c]/40 font-medium tracking-tight">{formatTime(post.created_at)}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveCommentPostId(isCommenting ? null : post.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all font-semibold ${isCommenting ? 'bg-[#5A5A40] text-white shadow-md' : 'text-[#2c2c2c]/40 hover:bg-white/60 hover:text-[#5A5A40]'}`}>
                <MessageCircle className="w-3.5 h-3.5" />
                {comments.length > 0 && <span>{comments.length}</span>}
              </button>
              <button onClick={() => handleSendFlower(post.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all font-bold ${hasFlowered ? 'bg-pink-100 text-pink-600 shadow-sm' : 'text-[#2c2c2c]/40 hover:bg-white/60 hover:text-pink-500'}`}>
                <span className={`transition-transform duration-300 ${hasFlowered ? 'scale-125' : 'group-hover:rotate-12'}`}>🌸</span>
                {flowerCount > 0 && <span>{flowerCount}</span>}
              </button>
              {(currentUser?.id === post.user_id || currentUser?.role === 'admin') && (
                pendingDeletePostId === post.id ? (
                  <div className="flex items-center gap-1 bg-red-50 p-1 rounded-full border border-red-100 shadow-sm">
                    <button onClick={async () => {
                      try {
                        await fetch(`/api/forum_posts/${post.id}`, { method: 'DELETE' });
                      } catch (e) {
                        try {
                          await fetch(`/api/forum_posts/${post.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: '[该动态已被删除]', forum_comments: [], flowers: [], _deleted: true }) });
setRefreshTrigger(prev => prev + 1);
                        } catch (e2) { console.error(e2); }
                      }
                      setPendingDeletePostId(null);
                    }} className="px-3 py-1 rounded-full text-[10px] bg-red-500 text-white font-black hover:bg-red-600 transition-colors uppercase">
                      删除
                    </button>
                    <button onClick={() => setPendingDeletePostId(null)} className="px-3 py-1 rounded-full text-[10px] text-red-400 font-bold hover:bg-white transition-colors">
                      取消
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setPendingDeletePostId(post.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-[#2c2c2c]/30 hover:bg-red-500 hover:text-white transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </div>
          </div>

          {/* Comments & Flowers area */}
          {(flowerCount > 0 || comments.length > 0 || isCommenting) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 bg-white/40 backdrop-blur-md rounded-2xl overflow-hidden border border-white/60 shadow-inner">
              {flowerCount > 0 && (
                <div className="px-4 py-2 text-[11px] text-[#5A5A40]/80 font-bold border-b border-white/20 flex items-center gap-2">
                  <span className="text-sm">🌸</span> {flowerCount} 位家人赠送了花朵寄托思念
                </div>
              )}
              {comments.length > 0 && (
                <div className="px-4 py-3 space-y-2.5">
                  {comments.map((c, i) => (
                    <div key={i} className="text-[13px] leading-relaxed group/comment">
                      <span className="font-bold text-[#5A5A40]">{c.user_name}</span>
                      <span className="text-[#2c2c2c]/80 font-medium">：{c.content}</span>
                    </div>
                  ))}
                </div>
              )}
              {isCommenting && (
                <div className="px-4 py-3 border-t border-white/20 bg-white/20 flex gap-2">
                  <input
                    type="text"
                    value={forumCommentInput}
                    onChange={(e) => setForumCommentInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && forumCommentInput.trim()) handleForumComment(post.id); }}
                    placeholder="说点温暖的话..."
                    className="flex-1 bg-white/60 border border-white/40 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                    autoFocus
                  />
                  <button onClick={() => handleForumComment(post.id)} disabled={!forumCommentInput.trim()}
                    className="px-4 py-2 bg-[#5A5A40] text-white rounded-xl text-xs font-bold hover:bg-[#4a4a35] disabled:opacity-50 shadow-md transition-all active:scale-95">
                    发送
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderMemorialCard = (memorial: Memorial) => (
    <motion.div key={memorial.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/60 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/40 flex flex-col hover:bg-white/80 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40] font-bold text-xl border border-[#5A5A40]/5">{memorial.author_name?.[0] || '名'}</div>
          <div>
            <h3 className="font-bold text-[#1a1a1a] tracking-tight">{memorial.author_name || '匿名'}</h3>
            <p className="text-[10px] text-[#2c2c2c]/40 font-bold uppercase tracking-widest">{formatTime(memorial.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isQingming && memorial.status && (
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${memorial.status === 'completed' ? 'bg-emerald-500 text-white' :
              memorial.status === 'in_progress' ? 'bg-blue-500 text-white' :
                memorial.status === 'accepted' ? 'bg-indigo-500 text-white' :
                  'bg-amber-500 text-white'
              }`}>
              {memorial.status === 'completed' ? '已完成' :
                memorial.status === 'in_progress' ? '进行中' :
                  memorial.status === 'accepted' ? '已接单' :
                    memorial.status === 'pending_order' ? '待接单' : '待支付'}
            </span>
          )}
          {currentUser.role === 'admin' && (
            <button onClick={() => handleDelete(memorial.id)} className="p-2 text-red-400 hover:bg-red-500 hover:text-white rounded-full transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
      </div>

      <div className="mb-4">
        {isQingming && memorial.name && <h4 className="text-xl font-serif font-bold mb-2 text-[#5A5A40] border-l-4 border-[#5A5A40] pl-3">{memorial.name}</h4>}
        <p className="text-[#2c2c2c]/90 whitespace-pre-wrap leading-relaxed text-[15px] font-medium">{memorial.message}</p>
      </div>

      {memorial.image_url && (
        <div className="mb-4 rounded-2xl overflow-hidden border border-white/60 shadow-lg">
          <img src={memorial.image_url} alt="配图" className="w-full h-auto max-h-[400px] object-cover transition-transform hover:scale-105 duration-700" referrerPolicy="no-referrer" />
        </div>
      )}

      {isQingming && (
        <div className="flex flex-wrap gap-2 mt-2">
          {memorial.status === 'pending_payment' && memorial.author_id === currentUser.id && (
            <button onClick={() => { setPendingMemorialId(memorial.id); setPaymentModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-[#5A5A40] text-white rounded-xl text-xs font-bold hover:bg-[#4a4a35] transition-all shadow-lg active:scale-95"><QrCode className="w-4 h-4" /> 立即支付</button>
          )}
          {currentUser.role === 'admin' && memorial.status === 'pending_order' && (
            <button onClick={() => handleAcceptOrder(memorial.id)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95"><CheckCircle className="w-4 h-4" /> 接单处理</button>
          )}
          {currentUser.role === 'admin' && memorial.status === 'in_progress' && (
            <button onClick={() => { setPendingMemorialId(memorial.id); setCompleteModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg active:scale-95"><CheckCircle className="w-4 h-4" /> 标记完成</button>
          )}
          {(memorial.author_id === currentUser.id || currentUser.role === 'admin') && (
            <button onClick={() => openChat(memorial)} className="flex items-center gap-2 px-5 py-2.5 bg-white/60 text-[#5A5A40] rounded-xl text-xs font-bold hover:bg-white transition-all border border-[#5A5A40]/10 shadow-sm active:scale-95"><MessageCircle className="w-4 h-4" /> 私信沟通</button>
          )}
        </div>
      )}

      {!isQingming && (
        <div className="mt-4 pt-5 border-t border-white/20">
          <div className="flex items-center gap-2 mb-4 text-[#5A5A40] font-bold">
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm">感言 ({memorial.comments?.length || 0})</span>
          </div>
          {memorial.comments && memorial.comments.length > 0 && (
            <div className="space-y-3 mb-4 bg-white/20 backdrop-blur-sm p-4 rounded-2xl border border-white/40 shadow-inner">
              {memorial.comments.map(comment => (
                <div key={comment.id} className="text-sm group/comment">
                  <span className="font-bold text-[#5A5A40] mr-2">{comment.user_name}:</span>
                  <span className="text-[#2c2c2c]/80 font-medium">{comment.content}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={commentInputs[memorial.id] || ''} onChange={(e) => setCommentInputs(prev => ({ ...prev, [memorial.id]: e.target.value }))} placeholder="写下温情的话语..." className="flex-1 bg-white/60 border border-white/40 rounded-xl px-5 py-2.5 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 outline-none transition-all" onKeyDown={(e) => { if (e.key === 'Enter') handleCommentSubmit(memorial.id); }} />
            <button onClick={() => handleCommentSubmit(memorial.id)} disabled={submittingCommentId === memorial.id || !commentInputs[memorial.id]?.trim()} className="p-3 bg-[#5A5A40] text-white rounded-xl hover:bg-[#4a4a35] transition-all disabled:opacity-50 shadow-md active:scale-95"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </motion.div>
  );

  const renderUserOrderTrackingView = () => {
    return (
      <>
        {userMemorials.length === 0 ? (
          <div className="text-center py-20">
            <Flower2 className="w-12 h-12 text-[#5A5A40]/20 mx-auto mb-4" />
            <p className="text-[#2c2c2c]/60">您还没有发布过追思记录</p>
            <p className="text-[#2c2c2c]/40 text-sm mt-2">点击首页的"发布追思"按钮开始</p>
          </div>
        ) : (
          userMemorials.map(m => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-[#2c2c2c]/5 overflow-hidden shadow-sm mb-4">
              <div className="px-6 py-5 border-b border-white/20 bg-white/20">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[15px] font-bold text-[#2c2c2c] tracking-tight">{m.name || (m.type === 'festival' ? '节日祭祀' : '个人追思')}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#2c2c2c]/40 font-bold uppercase tracking-widest">{formatTime(m.created_at)}</span>
                    <button onClick={() => handleDelete(m.id)} className="text-[11px] px-2 py-1 bg-red-50 text-red-500 rounded-md hover:bg-red-100 font-bold transition-colors flex items-center gap-1"><Trash2 className="w-3 h-3" />撤销</button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {[
                    { key: 'pending_payment', label: '待付费' },
                    { key: 'pending_order', label: '待审核' },
                    { key: 'accepted', label: '已接单' },
                    { key: 'in_progress', label: '进行中' },
                    { key: 'pending_acceptance', label: '待验收' },
                    { key: 'completed', label: '已完成' }
                  ].map((step, i, arr) => {
                    const statusOrder = ['pending_payment', 'pending_order', 'accepted', 'in_progress', 'pending_acceptance', 'completed'];
                    const currentIdx = statusOrder.indexOf(m.status);
                    const stepIdx = statusOrder.indexOf(step.key);
                    const isActive = stepIdx <= currentIdx;
                    const isCurrent = step.key === m.status;
                    return (
                      <React.Fragment key={step.key}>
                        <div className={`flex flex-col items-center flex-1`}>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black transition-all shadow-md ${isCurrent ? 'bg-[#5A5A40] text-white ring-4 ring-[#5A5A40]/20' :
                            isActive ? 'bg-[#5A5A40] text-white' :
                              'bg-white/40 text-[#2c2c2c]/20 border border-white/40'
                            }`}>
                            {isActive ? '✓' : i + 1}
                          </div>
                          <span className={`text-[10px] mt-1.5 font-bold uppercase tracking-tighter ${isCurrent ? 'text-[#5A5A40]' : isActive ? 'text-[#2c2c2c]/60' : 'text-[#2c2c2c]/20'}`}>{step.label}</span>
                        </div>
                        {i < arr.length - 1 && (
                          <div className={`h-1 flex-1 mt-[-24px] rounded-full ${stepIdx < currentIdx ? 'bg-[#5A5A40]' : 'bg-white/20'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              <div className="px-6 py-4 space-y-3">
                <div className="flex flex-wrap gap-3 text-xs">
                  {(m as any).plan && (
                    <div className="bg-[#5A5A40]/5 rounded-lg px-3 py-1.5">
                      <span className="text-[#2c2c2c]/40">方案：</span>
                      <span className="font-bold text-[#5A5A40]">¥{(m as any).plan}</span>
                    </div>
                  )}
                  {m.event_date && (
                    <div className="bg-[#f5f5f0] rounded-lg px-3 py-1.5">
                      <span className="text-[#2c2c2c]/40">日期：</span>
                      <span className="font-medium text-[#2c2c2c]">{m.event_date}</span>
                    </div>
                  )}
                  <div className="bg-[#f5f5f0] rounded-lg px-3 py-1.5">
                    <span className="text-[#2c2c2c]/40">类型：</span>
                    <span className="font-medium text-[#2c2c2c]">{m.type === 'festival' ? '节日祭祀' : '个人追思'}</span>
                  </div>
                </div>

                <p className="text-sm text-[#2c2c2c]/70 whitespace-pre-wrap bg-[#f5f5f0]/50 rounded-xl p-3">{m.message}</p>

                {normalizeImageUrls(m.progress_images).length > 0 && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200/50">
                    <span className="text-[10px] text-blue-700 font-bold block mb-2">📸 管理员提交的进度图片</span>
                    <div className="flex flex-wrap gap-2">
                      {normalizeImageUrls(m.progress_images).map((url, i) => (
                        <button
                          key={`${url}-${i}`}
                          type="button"
                          onClick={() => setImagePreview({ url, title: `进度图片 ${i + 1}` })}
                          className="text-xs text-blue-600 underline"
                        >
                          查看图片{i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {m.status === 'completed' && (normalizeImageUrls(m.completion_images).length > 0 || m.completion_remarks) && (
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200/50">
                    <span className="text-[10px] text-green-700 font-bold block mb-2">✅ 已完成</span>
                    {m.completion_remarks && <p className="text-xs text-green-800">📝 {m.completion_remarks}</p>}
                    {normalizeImageUrls(m.completion_images).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {normalizeImageUrls(m.completion_images).map((url, i) => (
                          <button
                            key={`${url}-${i}`}
                            type="button"
                            onClick={() => setImagePreview({ url, title: `完成反馈 ${i + 1}` })}
                            className="block w-20 h-20 rounded-lg overflow-hidden border border-green-200 bg-white"
                          >
                            <img src={url} alt={`完成反馈 ${i + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-3 bg-[#f5f5f0]/50 border-t border-[#2c2c2c]/5 flex gap-2">
                {m.status === 'pending_payment' && (
                  <button onClick={() => { setPendingMemorialId(m.id); setPaymentModalOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-[#5A5A40] text-white rounded-xl text-xs font-medium hover:bg-[#4a4a35] transition-colors shadow-sm">
                    <QrCode className="w-3.5 h-3.5" /> 立即支付
                  </button>
                )}
                {m.status === 'pending_acceptance' && (
                  pendingAcceptId === m.id ? (
                    <div className="flex items-center gap-2">
                      <button onClick={async () => {
                        try {
                          const res = await fetch(`/api/memorials/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) });
                          if (!res.ok) throw new Error('确认完成失败');
                          setRefreshTrigger(prev => prev + 1);
                        } catch (e) {
                          console.error('验收失败:', e);
                          alert('验收失败: ' + (e.message || e));
                        }
                        setPendingAcceptId(null);
                      }} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-medium hover:bg-green-700 transition-colors shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5" /> 确认完成
                      </button>
                      <button onClick={() => setPendingAcceptId(null)} className="px-3 py-2 text-xs text-[#2c2c2c]/50 hover:bg-[#f5f5f0] rounded-xl transition-colors">
                        取消
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setPendingAcceptId(m.id)} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-medium hover:bg-green-700 transition-colors shadow-sm">
                      <CheckCircle className="w-3.5 h-3.5" /> 确认验收
                    </button>
                  )
                )}
                <button onClick={() => setInlineChatMemorial(m)} className="flex items-center gap-1.5 px-4 py-2 bg-white text-[#5A5A40] border border-[#5A5A40]/20 rounded-xl text-xs font-medium hover:bg-[#5A5A40]/5 transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" /> 联系管理员
                </button>
              </div>
            </motion.div>
          ))
        )}
      </>
    );
  };

  return (
    <motion.div
      key="main"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="min-h-screen font-sans text-[#2c2c2c] relative bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url('/cover-bg.jpg')` }}
    >
      <div className="absolute inset-0 bg-[#f5f5f0]/85 backdrop-blur-xl transition-colors duration-1000" />
      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 w-full px-4 py-3 bg-white/20 backdrop-blur-xl border-b border-white/30 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-8 flex-1 w-full md:w-auto">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg">
                  <Flower2 className="w-5 h-5 text-[#5A5A40]" />
                </div>
                <h1 className="text-xl font-serif font-bold tracking-wider text-[#5A5A40]">云端追思</h1>
              </div>

              {currentUser.role !== 'admin' && (
                <div className="hidden md:flex flex-1 max-w-sm bg-white/40 backdrop-blur-md rounded-2xl p-3 border border-white/40 items-center justify-between shadow-sm relative group cursor-pointer hover:bg-white/60 transition-all z-50">
                  <div>
                    <h3 className="text-[11px] font-serif font-bold text-[#5A5A40]/70 mb-0.5">追思记录</h3>
                    {userMemorials.length > 0 ? (
                      <div className="flex flex-col">
                        <p className="text-xs text-[#2c2c2c]/80">
                          已经追思 <span className="font-bold text-[#5A5A40] text-sm">{userMemorials[userMemorials.length - 1].created_at ? differenceInDays(new Date(), new Date(userMemorials[userMemorials.length - 1].created_at)) : 0}</span> 天...
                        </p>
                        <p className="text-[10px] text-[#5A5A40] mt-0.5 font-medium truncate max-w-[200px]">
                          最新：{userMemorials[0].name || (userMemorials[0].type === 'festival' ? '节日祭祀' : '个人追思')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#2c2c2c]/50">您还没有发布过追思</p>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#5A5A40]/10 flex items-center justify-center shrink-0 group-hover:bg-[#5A5A40] transition-colors">
                    <Clock className="w-4 h-4 text-[#5A5A40] group-hover:text-white transition-colors" />
                  </div>

                  {/* Dropdown containing historical records */}
                  <div className="absolute top-[calc(100%+0.5rem)] left-0 w-[450px] bg-white/95 backdrop-blur-xl rounded-3xl border border-[#2c2c2c]/10 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 overflow-hidden flex flex-col max-h-[70vh] cursor-default">
                    <div className="px-5 py-4 border-b border-[#2c2c2c]/5 bg-[#f5f5f0]/50 flex items-center justify-between shrink-0">
                      <span className="font-bold text-[#5A5A40] text-sm">历史追思记录</span>
                      <span className="text-[10px] text-[#2c2c2c]/40 font-medium bg-white px-2 py-1 rounded-md border border-[#2c2c2c]/5 shadow-sm">共 {userMemorials.length} 条</span>
                    </div>
                    <div className="overflow-y-auto p-5 space-y-4 bg-[#f5f5f0]/30">
                      {renderUserOrderTrackingView()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
              <div className="relative group/user-menu">
                {/* Trigger */}
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} onBlur={() => setTimeout(() => setIsUserMenuOpen(false), 200)} className="flex items-center gap-2 bg-white/40 backdrop-blur-md pl-1.5 pr-4 py-1.5 rounded-full border border-white/40 shadow-sm cursor-pointer hover:bg-white/60 transition-all outline-none">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-[#5A5A40]/20 flex items-center justify-center bg-[#5A5A40]/5 shrink-0">
                    {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-[#5A5A40]" />
                    )}
                  </div>
                  <span className="text-sm text-[#5A5A40] font-bold">{currentUser.name}</span>
                </button>

                {/* Dropdown Menu */}
                <div className={`absolute right-0 top-full mt-2 w-48 transition-all duration-300 origin-top-right z-50 ${isUserMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible md:group-hover/user-menu:opacity-100 md:group-hover/user-menu:visible'}`}>
                  <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden flex flex-col p-2">
                    <div className="px-3 py-2 border-b border-[#2c2c2c]/5 mb-1">
                      <p className="text-[10px] text-[#2c2c2c]/40 font-bold uppercase tracking-widest mb-1">{currentUser.role === 'admin' ? '管理员' : '普通用户'}</p>
                      <p className="text-sm font-bold text-[#5A5A40] truncate">{currentUser.name}</p>
                    </div>

                    <button
                      onClick={() => setIsProfileModalOpen(true)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-[#2c2c2c] hover:bg-[#5A5A40]/5 rounded-xl transition-colors text-left font-medium"
                    >
                      {currentUser.role === 'admin' ? <Shield className="w-4 h-4 text-[#5A5A40]" /> : <User className="w-4 h-4 text-[#5A5A40]" />}
                      {currentUser.role === 'admin' ? '管理中心' : '个人资料设置'}
                    </button>

                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left mt-1 font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 pt-5 pb-32 lg:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className={`${mobileSection === 'forum' ? 'flex' : 'hidden'} lg:flex lg:col-span-2 flex-col gap-6`}>
              <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] lg:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-2xl border border-white/50 flex flex-col h-[calc(100vh-220px)] min-h-[520px] lg:h-[800px] group transition-all hover:bg-white/50">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2c2c2c]/5">
                  <div className="flex items-center gap-2">
                    <Flower2 className="w-6 h-6 text-[#5A5A40]" />
                    <h2 className="text-xl font-serif font-semibold text-[#2c2c2c]">追思圈</h2>
                  </div>
                  <div className="flex-1 ml-8 overflow-hidden">
                    <div className="whitespace-nowrap animate-marquee text-sm text-[#5A5A40] font-medium">
                      清明节将至，倡导文明祭扫，云端寄哀思。中元节即将到来，愿逝者安息，生者坚强。
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-4 py-5 animate-pulse">
                          <div className="w-12 h-12 rounded-xl bg-black/5 shrink-0" />
                          <div className="flex-1 space-y-3">
                            <div className="w-24 h-4 bg-black/5 rounded" />
                            <div className="w-full h-16 bg-black/5 rounded-xl" />
                            <div className="w-16 h-3 bg-black/5 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : forumPosts.length === 0 ? (
                    <p className="text-center text-[#2c2c2c]/60 py-10">还没有人发过动态，来分享你的思念吧...</p>
                  ) : (
                    forumPosts.map((post) => renderForumPostCard(post))
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-[#2c2c2c]/5 flex flex-col gap-4">
                  <form onSubmit={handleForumSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={forumInput}
                      onChange={(e) => setForumInput(e.target.value)}
                      placeholder="分享你的思念..."
                      className="flex-1 bg-[#f5f5f0] border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-[#5A5A40]/50 outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!forumInput.trim() || isForumSubmitting}
                      className="px-6 bg-[#5A5A40] text-white rounded-xl hover:bg-[#4a4a35] transition-colors disabled:opacity-50 font-medium"
                    >
                      {isForumSubmitting ? '发送中...' : '发送'}
                    </button>
                  </form>
                  <div className="bg-[#5A5A40]/5 rounded-xl h-10 flex items-center px-4 overflow-hidden relative shadow-inner">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={knowledgeIndex}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-x-4 whitespace-nowrap text-[13px] text-[#5A5A40]/90 font-medium flex items-center"
                      >
                        <span className="font-bold mr-2 text-[#5A5A40] shrink-0">✨ 道教常识：</span>
                        <span className="truncate">{TAOIST_KNOWLEDGE[knowledgeIndex]}</span>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${mobileSection === 'chat' ? 'flex' : 'hidden'} lg:flex lg:col-span-1 flex-col gap-6 lg:sticky lg:top-24 h-fit`}>
              <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl border border-white/50 flex flex-col h-[calc(100vh-220px)] min-h-[520px] lg:h-[600px] overflow-hidden group transition-all hover:bg-white/50">
                <div className="px-6 py-4 border-b border-[#2c2c2c]/5 bg-[#f5f5f0]/50 shrink-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-[#5A5A40]/10 flex items-center justify-center">
                      {aiCharacter ? <span className="text-lg">{aiCharacter.name?.[0] || '👤'}</span> : <User className="w-5 h-5 text-[#5A5A40]" />}
                    </div>
                    <div>
                      <h2 className="text-lg font-serif font-black text-[#5A5A40] tracking-tight">{aiCharacter ? `与 「${aiCharacter.name}」 对话` : '与去世亲人聊天'}</h2>
                      <p className="text-[10px] text-[#5A5A40]/40 font-bold uppercase tracking-widest">{aiCharacter ? 'AI 扮演您的亲人与您对话' : '请先选择一位亲人'}</p>
                    </div>
                  </div>
                  {/* Character Selector */}
                  {(() => {
                    const personMemorials = userMemorials.filter(m => m.type === 'person');
                    if (personMemorials.length === 0) return null;
                    return (
                      <select
                        value={aiCharacter?.id || ''}
                        onChange={(e) => {
                          const selected = personMemorials.find(m => m.id === e.target.value);
                          setAiCharacter(selected || null);
                          setAiMessages(selected ? [{ id: '1', role: 'ai', content: `你好啊。我是${selected.name}，你的${(selected as any).relation || '亲人'}。很高兴能和你说说话，有什么想对我说的吗？` }] : []);
                        }}
                        className="w-full bg-white/60 border border-white/40 rounded-xl px-4 py-2.5 text-xs font-bold text-[#5A5A40] outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all shadow-sm"
                      >
                        <option value="">请选择您想对话的亲人...</option>
                        {personMemorials.map(m => (
                          <option key={m.id} value={m.id}>{m.name}{(m as any).relation ? ` - ${(m as any).relation}` : ''}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#f5f5f0]/30">
                  {!aiCharacter && aiMessages.length === 0 ? (
                    <div className="text-center py-16 flex flex-col items-center justify-center">
                      <div className="w-20 h-20 bg-[#5A5A40]/5 rounded-full flex items-center justify-center mb-4 border border-[#5A5A40]/10">
                        <MessageCircle className="w-10 h-10 text-[#5A5A40]/30" />
                      </div>
                      <p className="text-[#5A5A40] font-bold text-lg mb-2">开启跨越时空的对话</p>
                      <p className="text-[#2c2c2c]/50 text-sm max-w-[200px] mb-6">请先在上方选择亲人。若暂无记录，请先发布您的第一条追思。</p>
                      <button 
                        onClick={() => {
                          setPublishType('person');
                          setIsPublishModalOpen(true);
                        }}
                        className="px-6 py-2.5 bg-white border border-[#5A5A40]/20 text-[#5A5A40] rounded-xl text-sm font-bold shadow-sm hover:bg-[#5A5A40]/5 transition-all flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> 去发布追思
                      </button>
                    </div>
                  ) : (
                    aiMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                          ? 'bg-[#5A5A40] text-white rounded-tr-sm shadow-sm'
                          : 'bg-white text-[#2c2c2c] border border-[#2c2c2c]/5 rounded-tl-sm shadow-sm'
                          }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {isAiTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-[#2c2c2c]/5 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
                        <div className="w-1.5 h-1.5 bg-[#5A5A40]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-[#5A5A40]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-[#5A5A40]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={aiMessagesEndRef} />
                </div>

                <div className="p-5 bg-white/20 border-t border-white/20 shrink-0">
                  <form onSubmit={handleAiSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="说点悄悄话..."
                      className="flex-1 bg-white/60 border border-white/40 rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-[#5A5A40]/30 outline-none transition-all shadow-inner font-medium"
                    />
                    <button
                      type="submit"
                      disabled={!aiInput.trim() || isAiTyping}
                      className="p-3 bg-[#5A5A40] text-white rounded-2xl hover:bg-[#4a4a35] transition-all disabled:opacity-50 flex items-center justify-center shadow-lg active:scale-95"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </div>

              <button
                onClick={() => setIsPublishModalOpen(true)}
                className="hidden lg:flex w-full bg-gradient-to-r from-[#5A5A40] to-[#7a7a60] text-white py-5 rounded-[2rem] font-serif font-bold text-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1.5 items-center justify-center gap-3 active:scale-95"
              >
                <Plus className="w-7 h-7" />
                发布追思
              </button>
            </div>
          </div>
        </main>

        {/* Mobile Floating Action Button */}
        <button
          onClick={() => setIsPublishModalOpen(true)}
          aria-label="发布追思"
          className="lg:hidden fixed bottom-24 right-5 z-40 bg-gradient-to-r from-[#5A5A40] to-[#7a7a60] text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-95 hover:scale-105 transition-all"
        >
          <Plus className="w-7 h-7" />
        </button>

        <nav className="lg:hidden fixed bottom-4 left-4 right-4 z-50 grid grid-cols-3 gap-2 rounded-[1.5rem] border border-white/60 bg-white/80 backdrop-blur-2xl p-2 shadow-2xl">
          <button
            type="button"
            onClick={() => setMobileSection('forum')}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-[11px] font-bold transition-all ${mobileSection === 'forum' ? 'bg-[#5A5A40] text-white shadow-lg' : 'text-[#5A5A40]/60 hover:bg-white/70'}`}
          >
            <Flower2 className="w-4 h-4" />
            追思圈
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('chat')}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-[11px] font-bold transition-all ${mobileSection === 'chat' ? 'bg-[#5A5A40] text-white shadow-lg' : 'text-[#5A5A40]/60 hover:bg-white/70'}`}
          >
            <MessageCircle className="w-4 h-4" />
            亲人聊天
          </button>
          <button
            type="button"
            onClick={() => currentUser.role === 'admin' ? setIsProfileModalOpen(true) : setIsUserRecordsModalOpen(true)}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-[11px] font-bold text-[#5A5A40]/60 hover:bg-white/70 transition-all"
          >
            {currentUser.role === 'admin' ? <Shield className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            {currentUser.role === 'admin' ? '管理' : '记录'}
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {isUserRecordsModalOpen && currentUser.role !== 'admin' && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsUserRecordsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-2xl bg-white/90 backdrop-blur-2xl rounded-[2rem] overflow-hidden flex flex-col max-h-[82vh] shadow-2xl border border-white/50"
            >
              <div className="px-5 py-4 border-b border-[#2c2c2c]/5 bg-[#f5f5f0]/70 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#5A5A40]/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#5A5A40]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-[#2c2c2c]">我的追思记录</h3>
                    <p className="text-xs text-[#2c2c2c]/50">共 {userMemorials.length} 条发布记录</p>
                  </div>
                </div>
                <button onClick={() => setIsUserRecordsModalOpen(false)} className="p-2 hover:bg-white/60 rounded-full transition-colors">
                  <X className="w-5 h-5 text-[#2c2c2c]/50" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-[#f5f5f0]/30">
                {renderUserOrderTrackingView()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {paymentModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white rounded-[32px] p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><QrCode className="w-8 h-8 text-green-600" /></div>
              <h3 className="text-2xl font-serif font-bold mb-2">扫码支付</h3>
              <p className="text-[#2c2c2c]/60 mb-8">请扫描下方二维码完成支付，支付成功后管理员将为您处理追思申请。</p>
              <div className="bg-[#f5f5f0] aspect-square rounded-2xl mb-8 flex items-center justify-center border-2 border-dashed border-[#2c2c2c]/10"><QrCode className="w-32 h-32 text-[#5A5A40]/20" /></div>
              <button onClick={handlePaymentComplete} className="w-full bg-[#5A5A40] text-white py-4 rounded-xl font-medium hover:bg-[#4a4a35] transition-colors">我已支付</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatModalOpen && currentChatMemorial && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setChatModalOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-md bg-white rounded-[32px] overflow-hidden flex flex-col h-[80vh]">
              <div className="px-6 py-4 border-b border-[#2c2c2c]/5 flex items-center justify-between bg-[#f5f5f0]/50">
                <div><h3 className="font-serif font-bold">沟通详情</h3><p className="text-[10px] text-[#2c2c2c]/40">关于：{currentChatMemorial.name}</p></div>
                <button onClick={() => setChatModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#f5f5f0]/30">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.sender_id === currentUser?.id ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[8px] text-[#2c2c2c]/20">{formatTime(msg.created_at)}</span>
                    </div>
                    <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${msg.sender_id === currentUser?.id ? 'bg-[#5A5A40] text-white rounded-tr-none' : 'bg-white text-[#2c2c2c] shadow-sm rounded-tl-none'}`}>{msg.content}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-[#2c2c2c]/5 flex gap-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="输入消息..." className="flex-1 bg-[#f5f5f0] border-none rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-[#5A5A40] outline-none" />
                <button type="submit" disabled={!newMessage.trim()} className="p-2 bg-[#5A5A40] text-white rounded-xl hover:bg-[#4a4a35] transition-colors disabled:opacity-50"><Send className="w-4 h-4" /></button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {completeModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCompleteModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-[32px] p-8">
              <h3 className="text-2xl font-serif font-bold mb-6">完成追思服务</h3>
              <form onSubmit={handleCompleteOrder} className="space-y-4">
                <div><label className="block text-xs font-medium text-[#2c2c2c]/40 mb-1">完成时间</label><input type="datetime-local" required value={completeData.time} onChange={(e) => setCompleteData({ ...completeData, time: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-[#2c2c2c]/10 outline-none bg-[#f5f5f0]/50" /></div>
                <div><label className="block text-xs font-medium text-[#2c2c2c]/40 mb-1">完成地点</label><input type="text" required value={completeData.location} onChange={(e) => setCompleteData({ ...completeData, location: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-[#2c2c2c]/10 outline-none bg-[#f5f5f0]/50" placeholder="如：XX公墓" /></div>
                <div>
                  <label className="block text-xs font-medium text-[#2c2c2c]/40 mb-1">现场照片（本地上传）</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isCompletionUploading}
                    onChange={async (e) => {
                      const files = e.currentTarget.files;
                      if (!files || files.length === 0) return;
                      setIsCompletionUploading(true);
                      try {
                        const urls = await uploadLocalImages(files);
                        setCompleteData(prev => ({ ...prev, images: [...prev.images, ...urls] }));
                      } catch (error: any) {
                        alert(error.message || '现场照片上传失败');
                      } finally {
                        setIsCompletionUploading(false);
                        e.currentTarget.value = '';
                      }
                    }}
                    className="w-full px-4 py-2 rounded-xl border border-[#2c2c2c]/10 outline-none bg-[#f5f5f0]/50 text-sm"
                  />
                  {isCompletionUploading && <p className="text-xs text-[#5A5A40] mt-1">照片上传中...</p>}
                  {completeData.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {completeData.images.map((url, i) => (
                        <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#2c2c2c]/10 bg-[#f5f5f0]">
                          <img src={url} alt={`现场照片 ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            title="移除这张现场照片"
                            aria-label={`移除现场照片 ${i + 1}`}
                            onClick={() => setCompleteData(prev => ({ ...prev, images: prev.images.filter(item => item !== url) }))}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none hover:bg-red-600 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div><label className="block text-xs font-medium text-[#2c2c2c]/40 mb-1">备注说明</label><textarea value={completeData.remarks} onChange={(e) => setCompleteData({ ...completeData, remarks: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-[#2c2c2c]/10 outline-none bg-[#f5f5f0]/50 resize-none" rows={3} /></div>
                <button type="submit" disabled={isCompletionUploading} className="w-full bg-[#5A5A40] text-white py-4 rounded-xl font-medium hover:bg-[#4a4a35] transition-colors mt-4 disabled:opacity-50">确认完成</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {imagePreview && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setImagePreview(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center"
            >
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="absolute -top-3 -right-3 z-10 w-10 h-10 rounded-full bg-white text-[#2c2c2c] shadow-xl flex items-center justify-center hover:bg-[#f5f5f0] transition-colors"
                aria-label="关闭图片预览"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={imagePreview.url}
                alt={imagePreview.title}
                className="max-w-full max-h-[82vh] object-contain rounded-2xl bg-white/5 shadow-2xl"
              />
              <div className="mt-3 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium">
                {imagePreview.title}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsProfileModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`relative w-full ${currentUser?.role === 'admin' ? 'max-w-4xl' : 'max-w-2xl'} bg-white/60 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border border-white/50`}>
              <div className="px-8 py-6 border-b border-white/20 bg-white/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#5A5A40]/10 flex items-center justify-center">
                    {currentUser?.role === 'admin' ? <Shield className="w-5 h-5 text-[#5A5A40]" /> : (currentUser?.avatar ? <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-[#5A5A40]" />)}
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-bold text-[#2c2c2c]">{currentUser?.role === 'admin' ? '订单管理中心' : '个人中心'}</h3>
                    <p className="text-sm text-[#2c2c2c]/60">{currentUser?.role === 'admin' ? '审核订单・确认付费・对接用户・跟踪进度' : '您的历史追思记录'}</p>
                  </div>
                </div>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-2 hover:bg-white/40 rounded-full transition-colors"><X className="w-6 h-6 text-[#2c2c2c]/40" /></button>
              </div>

              {/* Admin: Status filter tabs */}
              {currentUser?.role === 'admin' && (
                <div className="px-8 pt-4 pb-2 bg-white/10 border-b border-white/20 shrink-0 flex gap-2 flex-wrap">
                  {[
                    { key: 'all' as const, label: '全部', count: adminMemorials.length },
                    { key: 'pending_payment' as const, label: '💰 待付费', count: adminMemorials.filter(m => m.status === 'pending_payment').length },
                    { key: 'pending_order' as const, label: '📋 待审核', count: adminMemorials.filter(m => m.status === 'pending_order').length },
                    { key: 'accepted' as const, label: '✅ 已接单', count: adminMemorials.filter(m => m.status === 'accepted').length },
                    { key: 'in_progress' as const, label: '🔄 进行中', count: adminMemorials.filter(m => m.status === 'in_progress').length },
                    { key: 'pending_acceptance' as const, label: '👁️ 待验收', count: adminMemorials.filter(m => m.status === 'pending_acceptance').length },
                    { key: 'completed' as const, label: '✔️ 已完成', count: adminMemorials.filter(m => m.status === 'completed').length },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setAdminFilter(tab.key)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${adminFilter === tab.key ? 'bg-[#5A5A40] text-white shadow-lg scale-105' : 'bg-white/40 text-[#5A5A40]/60 hover:bg-white/60 hover:text-[#5A5A40]'
                        }`}>
                      {tab.label} {tab.count > 0 && <span className="ml-1 opacity-70">({tab.count})</span>}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {currentUser?.role === 'admin' ? (
                  /* ========= ADMIN ORDER MANAGEMENT VIEW ========= */
                  (() => {
                    const filtered = adminFilter === 'all' ? adminMemorials : adminMemorials.filter(m => m.status === adminFilter);
                    if (filtered.length === 0) return (
                      <div className="text-center py-20">
                        <Flower2 className="w-12 h-12 text-[#5A5A40]/20 mx-auto mb-4" />
                        <p className="text-[#2c2c2c]/60">当前筛选条件下暂无订单</p>
                      </div>
                    );
                    return filtered.map(m => (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/40 backdrop-blur-md rounded-[2rem] border border-white/60 overflow-hidden shadow-xl mb-4 transition-all hover:bg-white/60">
                        {/* Order Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-[#2c2c2c]/5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40] font-bold text-sm">{m.author_name?.[0] || '用'}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-[#2c2c2c]">{m.author_name || '匿名用户'}</span>
                                <span className="text-[10px] text-[#2c2c2c]/30">ID: {m.author_id?.slice(0, 8)}...</span>
                              </div>
                              <span className="text-xs text-[#2c2c2c]/40">{formatTime(m.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${m.status === 'completed' ? 'bg-green-100 text-green-700' :
                              m.status === 'pending_acceptance' ? 'bg-purple-100 text-purple-700' :
                                m.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                  m.status === 'accepted' ? 'bg-indigo-100 text-indigo-700' :
                                    m.status === 'pending_order' ? 'bg-amber-100 text-amber-700' :
                                      'bg-gray-100 text-gray-600'
                              }`}>
                              {m.status === 'completed' ? '✔ 已完成' :
                                m.status === 'pending_acceptance' ? '👁 待验收' :
                                  m.status === 'in_progress' ? '🔄 进行中' :
                                    m.status === 'accepted' ? '✅ 已接单' :
                                      m.status === 'pending_order' ? '📋 待审核' : '💰 待付费'}
                            </span>
                          </div>
                        </div>

                        {/* Order Body */}
                        <div className="px-6 py-4 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div className="bg-[#f5f5f0] rounded-xl p-3">
                              <span className="text-[#2c2c2c]/40 block mb-1">类型</span>
                              <span className="font-semibold text-[#2c2c2c]">{m.type === 'festival' ? '🕯️ 节日祭祀' : '🌸 个人追思'}</span>
                            </div>
                            {m.name && <div className="bg-[#f5f5f0] rounded-xl p-3">
                              <span className="text-[#2c2c2c]/40 block mb-1">主题/姓名</span>
                              <span className="font-semibold text-[#2c2c2c]">{m.name}</span>
                            </div>}
                            {(m as any).plan && <div className="bg-[#f5f5f0] rounded-xl p-3">
                              <span className="text-[#2c2c2c]/40 block mb-1">方案金额</span>
                              <span className="font-bold text-[#5A5A40] text-base">¥{(m as any).plan}</span>
                            </div>}
                            {m.event_date && <div className="bg-[#f5f5f0] rounded-xl p-3">
                              <span className="text-[#2c2c2c]/40 block mb-1">祭祀日期</span>
                              <span className="font-semibold text-[#2c2c2c]">{m.event_date}</span>
                            </div>}
                          </div>
                          <div className="bg-[#f5f5f0]/60 rounded-xl p-4">
                            <span className="text-[10px] text-[#2c2c2c]/40 font-medium block mb-1">用户留言</span>
                            <p className="text-sm text-[#2c2c2c]/80 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                          </div>
                          {(m as any).remarks && (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200/50">
                              <span className="text-[10px] text-amber-700 font-medium block mb-1">📝 用户备注</span>
                              <p className="text-sm text-amber-800 whitespace-pre-wrap">{(m as any).remarks}</p>
                            </div>
                          )}
                          {/* Progress images from admin */}
                          {normalizeImageUrls(m.progress_images).length > 0 && (
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200/50">
                              <span className="text-[10px] text-blue-700 font-bold block mb-2">📸 已提交的进度图片</span>
                              <div className="flex flex-wrap gap-2">
                                {normalizeImageUrls(m.progress_images).map((url: string, i: number) => (
                                  <div key={`${url}-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-blue-200 bg-white">
                                    <button
                                      type="button"
                                      onClick={() => setImagePreview({ url, title: `进度图片 ${i + 1}` })}
                                      className="block w-full h-full"
                                      title={`查看进度图片 ${i + 1}`}
                                    >
                                      <img src={url} alt={`进度图片 ${i + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                    <button
                                      type="button"
                                      title="删除这张进度照片"
                                      aria-label={`删除进度照片 ${i + 1}`}
                                      onClick={() => handleDeleteProgressImage(m, i)}
                                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/65 text-white text-xs leading-none hover:bg-red-600 transition-colors"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {m.image_url && (
                            <div className="rounded-xl overflow-hidden border border-[#2c2c2c]/5">
                              <img src={m.image_url} alt="配图" className="w-full h-auto max-h-48 object-cover" />
                            </div>
                          )}
                        </div>

                        {/* Order Actions */}
                        <div className="px-6 py-4 bg-[#f5f5f0]/50 border-t border-[#2c2c2c]/5 flex flex-wrap gap-2">
                          {m.status === 'pending_payment' && (
                            <button onClick={async () => { try { await fetch(`/api/memorials/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending_order' })
      });
setRefreshTrigger(prev => prev + 1); } catch (e) { console.error(e); } }} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                              <CheckCircle className="w-3.5 h-3.5" /> 确认已付费
                            </button>
                          )}
                          {m.status === 'pending_order' && (
                            <button onClick={() => handleAcceptOrder(m.id)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                              <CheckCircle className="w-3.5 h-3.5" /> 审核通过・接单
                            </button>
                          )}
                          {m.status === 'accepted' && (
                            <button onClick={async () => { try { await fetch(`/api/memorials/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' })
      });
setRefreshTrigger(prev => prev + 1); } catch (e) { console.error(e); } }} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm">
                              <Clock className="w-3.5 h-3.5" /> 开始执行
                            </button>
                          )}
                          {m.status === 'in_progress' && (
                            <>
                              <label className={`flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-medium transition-colors shadow-sm ${progressUploadingId === m.id ? 'opacity-60 cursor-wait' : 'hover:bg-sky-700 cursor-pointer'}`}>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  disabled={progressUploadingId === m.id}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const files = e.currentTarget.files;
                                    if (!files || files.length === 0) return;
                                    setProgressUploadingId(m.id);
                                    try {
                                      const urls = await uploadLocalImages(files);
                                      const existing = normalizeImageUrls((m as any).progress_images);
                                      const response = await fetch(`/api/memorials/${m.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ progress_images: [...existing, ...urls] })
                                      });
                                      if (!response.ok) throw new Error('进度照片保存失败');
                                      setRefreshTrigger(prev => prev + 1);
                                    } catch (error: any) {
                                      console.error(error);
                                      alert(error.message || '进度照片上传失败');
                                    } finally {
                                      setProgressUploadingId(null);
                                      e.currentTarget.value = '';
                                    }
                                  }}
                                />
                                📸 {progressUploadingId === m.id ? '上传中...' : '提交进度照片'}
                              </label>
                              <button onClick={async () => { try { await fetch(`/api/memorials/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending_acceptance' })
      });
setRefreshTrigger(prev => prev + 1); } catch (e) { console.error(e); } }} className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-medium hover:bg-purple-700 transition-colors shadow-sm">
                                <CheckCircle className="w-3.5 h-3.5" /> 提交验收
                              </button>
                            </>
                          )}
                          {m.status === 'pending_acceptance' && (
                            <span className="text-xs text-purple-600 font-medium py-2">⏳ 等待用户验收中...</span>
                          )}
                          <button onClick={() => setInlineChatMemorial(m)} className="flex items-center gap-1.5 px-4 py-2 bg-white text-[#5A5A40] border border-[#5A5A40]/20 rounded-xl text-xs font-medium hover:bg-[#5A5A40]/5 transition-colors">
                            <MessageCircle className="w-3.5 h-3.5" /> 与用户沟通
                          </button>
                          <button onClick={() => handleDelete(m.id)} className="flex items-center gap-1.5 px-4 py-2 bg-white text-red-500 border border-red-200 rounded-xl text-xs font-medium hover:bg-red-50 transition-colors ml-auto">
                            <Trash2 className="w-3.5 h-3.5" /> 删除
                          </button>
                        </div>
                      </motion.div>
                    ));
                  })()
                ) : (
                  /* ========= USER PROFILE VIEW ========= */
                  <UserProfileSettings currentUser={currentUser} setCurrentUser={setCurrentUser} setRefreshTrigger={setRefreshTrigger} />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Chat Popup - overlays profile modal */}
      <AnimatePresence>
        {inlineChatMemorial && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40" onClick={() => { setInlineChatMemorial(null); setInlineChatMessages([]); setInlineChatInput(''); }} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[24px] overflow-hidden shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
              {/* Chat Header with identity */}
              <div className="px-6 py-4 bg-[#5A5A40] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                    {currentUser?.role === 'admin' ? <User className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">
                      {currentUser?.role === 'admin'
                        ? `与用户「${inlineChatMemorial.author_name || '匿名用户'}」沟通`
                        : '与管理员沟通'
                      }
                    </h3>
                    <p className="text-[11px] text-white/60">订单：{inlineChatMemorial.name || (inlineChatMemorial.type === 'festival' ? '节日祭祀' : '个人追思')}{(inlineChatMemorial as any).plan ? ` · ¥${(inlineChatMemorial as any).plan}` : ''}</p>
                  </div>
                </div>
                <button onClick={() => { setInlineChatMemorial(null); setInlineChatMessages([]); setInlineChatInput(''); }} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#f5f5f0]/30">
                {inlineChatMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="w-10 h-10 text-[#2c2c2c]/10 mx-auto mb-3" />
                    <p className="text-[#2c2c2c]/40 text-sm">暂无消息</p>
                    <p className="text-[#2c2c2c]/30 text-xs mt-1">发送第一条消息开始沟通吧</p>
                  </div>
                ) : (
                  inlineChatMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${msg.sender_id === currentUser?.id
                        ? 'bg-[#5A5A40] text-white rounded-br-md'
                        : 'bg-white text-[#2c2c2c] border border-[#2c2c2c]/10 rounded-bl-md shadow-sm'
                        }`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${msg.sender_id === currentUser?.id ? 'text-white/50' : 'text-[#2c2c2c]/30'}`}>
                          {msg.sender_name} · {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={inlineChatEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!inlineChatInput.trim() || !inlineChatMemorial || !currentUser) return;
                try {
                  await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: uuidv4(), 
                    memorial_id: inlineChatMemorial.id,
                    sender_name: currentUser.name,
                    sender_id: currentUser.id,
                    content: inlineChatInput.trim(),
                     created_at: new Date().toISOString() }) });
                  setInlineChatInput('');
                  const res = await fetch(`/api/messages?memorial_id=${inlineChatMemorial.id}`).then(r => r.json());
          setInlineChatMessages((res || []).map((doc: any) => ({ ...doc, id: doc._id || doc.id } as Message)));
                } catch (err) {
                  console.error('发送失败:', err);
                }
              }} className="px-5 py-4 border-t border-[#2c2c2c]/5 flex gap-3 bg-white shrink-0">
                <input
                  type="text"
                  value={inlineChatInput}
                  onChange={(e) => setInlineChatInput(e.target.value)}
                  placeholder="输入消息..."
                  className="flex-1 bg-[#f5f5f0] border-none rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-[#5A5A40]/30 outline-none"
                  autoFocus
                />
                <button type="submit" disabled={!inlineChatInput.trim()} className="px-5 py-3 bg-[#5A5A40] text-white rounded-full text-sm font-medium hover:bg-[#4a4a35] transition-colors disabled:opacity-50 flex items-center gap-2">
                  <Send className="w-4 h-4" /> 发送
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPublishModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPublishModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`relative w-full ${publishType === 'festival' ? 'max-w-4xl' : 'max-w-md'} bg-white/60 backdrop-blur-2xl rounded-[2.5rem] p-10 max-h-[90vh] overflow-y-auto shadow-2xl border border-white/50 transition-all`}>
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-serif font-black text-[#5A5A40]">发布追思</h3>
                <button onClick={() => setIsPublishModalOpen(false)} className="p-2 hover:bg-white/40 rounded-full transition-colors"><X className="w-6 h-6 text-[#5A5A40]" /></button>
              </div>

              <div className="flex gap-2 p-1.5 bg-white/20 backdrop-blur-md rounded-2xl mb-8 border border-white/40">
                <button onClick={() => setPublishType('person')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${publishType === 'person' ? 'bg-[#5A5A40] text-white shadow-lg' : 'text-[#5A5A40]/60 hover:text-[#5A5A40]'}`}>个人追思</button>
                <button onClick={() => setPublishType('festival')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${publishType === 'festival' ? 'bg-[#5A5A40] text-white shadow-lg' : 'text-[#5A5A40]/60 hover:text-[#5A5A40]'}`}>节日祭祀</button>
              </div>

              {publishType === 'person' ? (
                <form onSubmit={handlePersonSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div><label className="block text-[11px] font-black text-[#5A5A40]/40 uppercase tracking-widest mb-1.5 ml-1">逝者姓名</label><input type="text" value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full px-5 py-3.5 rounded-2xl border border-white/40 outline-none bg-white/40 focus:bg-white/60 focus:border-[#5A5A40] transition-all shadow-inner" placeholder="如：张三" /></div>
                    <div><label className="block text-[11px] font-black text-[#5A5A40]/40 uppercase tracking-widest mb-1.5 ml-1">与您的关系</label><input type="text" value={personRelation} onChange={(e) => setPersonRelation(e.target.value)} className="w-full px-5 py-3.5 rounded-2xl border border-white/40 outline-none bg-white/40 focus:bg-white/60 focus:border-[#5A5A40] transition-all shadow-inner" placeholder="如：父亲、母亲、爷爷、奶奶" /></div>
                    <div><label className="block text-[11px] font-black text-[#5A5A40]/40 uppercase tracking-widest mb-1.5 ml-1">生于</label><input type="date" value={personBirthDate} onChange={(e) => setPersonBirthDate(e.target.value)} className="w-full px-5 py-3.5 rounded-2xl border border-white/40 outline-none bg-white/40 focus:bg-white/60 focus:border-[#5A5A40] transition-all shadow-inner" /></div>
                    <div><label className="block text-[11px] font-black text-[#5A5A40]/40 uppercase tracking-widest mb-1.5 ml-1">殁于</label><input type="date" value={personDeathDate} onChange={(e) => setPersonDeathDate(e.target.value)} className="w-full px-5 py-3.5 rounded-2xl border border-white/40 outline-none bg-white/40 focus:bg-white/60 focus:border-[#5A5A40] transition-all shadow-inner" /></div>
                  </div>
                  <div><label className="block text-[11px] font-black text-[#5A5A40]/40 uppercase tracking-widest mb-1.5 ml-1">想说的话 *</label><textarea required value={personMessage} onChange={(e) => setPersonMessage(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-white/40 outline-none bg-white/40 focus:bg-white/60 focus:border-[#5A5A40] transition-all shadow-inner resize-none" rows={4} placeholder="写下您的思念..." /></div>
                  <div><label className="block text-[11px] font-black text-[#5A5A40]/40 uppercase tracking-widest mb-1.5 ml-1">照片链接</label><input type="url" value={personImageUrl} onChange={(e) => setPersonImageUrl(e.target.value)} className="w-full px-5 py-3.5 rounded-2xl border border-white/40 outline-none bg-white/40 focus:bg-white/60 focus:border-[#5A5A40] transition-all shadow-inner" placeholder="https://..." /></div>
                  <button type="submit" disabled={isPersonSubmitting} className="w-full bg-gradient-to-r from-[#5A5A40] to-[#7a7a60] text-white py-5 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 mt-4 disabled:opacity-50 active:scale-95">{isPersonSubmitting ? '发布中...' : '确认发布'}</button>
                </form>
              ) : (
                <form onSubmit={handleFestivalSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 gap-4">
                    <div><label className="block text-xs font-medium text-[#2c2c2c]/40 mb-1">祭祀主题</label><input type="text" value={festivalName} onChange={(e) => setFestivalName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#2c2c2c]/10 outline-none bg-[#f5f5f0]/50 focus:border-[#5A5A40] transition-colors" placeholder="如：清明祭祖" /></div>
                    <div><label className="block text-xs font-medium text-[#2c2c2c]/40 mb-1">祭祀日期</label><input type="date" value={festivalEventDate} onChange={(e) => setFestivalEventDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#2c2c2c]/10 outline-none bg-[#f5f5f0]/50 focus:border-[#5A5A40] transition-colors" /></div>
                  </div>

                  {/* 祭祀方案选择 */}
                  <div>
                    <label className="block text-xs font-medium text-[#2c2c2c]/40 mb-3">选择祭祀方案 *</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        {
                          price: 50 as const, name: '基础祭祀', tag: '入门之选', items: [
                            '🌸 线上献花一束（电子仿真菊花）',
                            '📝 基础追思文案代发（200字以内）',
                            '🕯️ 电子长明灯一盏（平台展示7天）',
                            '🙏 平台祈福墙留言展示',
                            '📋 电子追思卡一份（可分享）'
                          ]
                        },
                        {
                          price: 500 as const, name: '标准祭祀', tag: '热门推荐', items: [
                            '✅ 含基础祭祀全部服务',
                            '🏛️ 合规道观现场代祭一次',
                            '🍎 三牲五果供品一套（时令水果、糕点、素食）',
                            '📜 环保竹浆黄表纸一份（低烟可降解）',
                            '🪔 酥油灯供奉三盏',
                            '🧧 祈福回向文疏代写一份',
                            '📸 现场祭祀实拍照片5张回传',
                            '💐 鲜花花束供奉（应季白菊或黄菊）'
                          ]
                        },
                        {
                          price: 2000 as const, name: '尊享祭祀', tag: '至臻礼遇', items: [
                            '✅ 含标准祭祀全部服务',
                            '☯️ 专属超度法事一场（道长主持约30分钟）',
                            '📹 全程高清视频记录并回传',
                            '🎴 定制实体纪念卡一份（含逝者信息与追思辞，精装邮寄到家）',
                            '🪷 莲花灯供奉一盏（手工制作）',
                            '📿 开光祈福护身符一枚（邮寄到家）',
                            '🎐 风铃祈愿牌悬挂（道观保留一年）',
                            '🕊️ 专属客服一对一全程跟进',
                            '📑 完整祭祀报告书（含照片、视频、法事记录）'
                          ]
                        }
                      ].map((plan) => (
                        <button
                          key={plan.price}
                          type="button"
                          onClick={() => setFestivalPlan(plan.price)}
                          className={`relative flex flex-col p-6 rounded-3xl border-2 transition-all text-left ${festivalPlan === plan.price
                            ? 'border-[#5A5A40] bg-white/80 shadow-2xl ring-1 ring-[#5A5A40]/20 scale-[1.02] z-10'
                            : 'border-white/40 bg-white/40 hover:border-[#5A5A40]/30 hover:shadow-lg'
                            }`}
                        >
                          {plan.price === 500 && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-[#5A5A40] to-[#7a7a60] text-white text-[10px] font-bold rounded-full shadow">🔥 热门推荐</span>
                          )}
                          <div className="flex items-center justify-between w-full mb-3">
                            <div>
                              <span className="text-2xl font-bold text-[#5A5A40]">¥{plan.price}</span>
                              <span className="text-xs text-[#2c2c2c]/40 ml-1">/次</span>
                            </div>
                            {festivalPlan === plan.price && (
                              <div className="w-6 h-6 bg-[#5A5A40] rounded-full flex items-center justify-center">
                                <CheckCircle className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-bold text-[#2c2c2c] mb-1">{plan.name}</span>
                          <span className="text-[10px] text-[#5A5A40]/70 font-medium mb-3 border-b border-[#2c2c2c]/5 pb-3">{plan.tag}</span>
                          <ul className="space-y-1.5 w-full">
                            {plan.items.map((item, i) => (
                              <li key={i} className="text-[11px] text-[#2c2c2c]/60 leading-snug">{item}</li>
                            ))}
                          </ul>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div><label className="block text-[11px] font-black text-[#5A5A40]/40 uppercase tracking-widest mb-1.5 ml-1">想说的话 *</label><textarea required value={festivalMessage} onChange={(e) => setFestivalMessage(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-white/40 outline-none bg-white/40 focus:bg-white/60 focus:border-[#5A5A40] transition-all shadow-inner resize-none" rows={3} placeholder="写下您的思念..." /></div>
                  <div><label className="block text-[11px] font-black text-[#5A5A40]/40 uppercase tracking-widest mb-1.5 ml-1">备注</label><textarea value={festivalRemarks} onChange={(e) => setFestivalRemarks(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-white/40 outline-none bg-white/40 focus:bg-white/60 focus:border-[#5A5A40] transition-all shadow-inner resize-none" rows={2} placeholder="如有特殊要求请在此备注..." /></div>
                  <div><label className="block text-[11px] font-black text-[#5A5A40]/40 uppercase tracking-widest mb-1.5 ml-1">配图链接</label><input type="url" value={festivalImageUrl} onChange={(e) => setFestivalImageUrl(e.target.value)} className="w-full px-5 py-3.5 rounded-2xl border border-white/40 outline-none bg-white/40 focus:bg-white/60 focus:border-[#5A5A40] transition-all shadow-inner" placeholder="https://..." /></div>

                  <div className="bg-[#5A5A40]/10 backdrop-blur-md rounded-2xl p-5 flex items-center justify-between border border-[#5A5A40]/20">
                    <span className="text-sm font-bold text-[#5A5A40]/70 uppercase tracking-widest">当前方案费用</span>
                    <span className="text-3xl font-black text-[#5A5A40]">¥{festivalPlan}</span>
                  </div>

                  <button type="submit" disabled={isFestivalSubmitting} className="w-full bg-gradient-to-r from-[#5A5A40] to-[#7a7a60] text-white py-5 rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 mt-4 disabled:opacity-50 active:scale-95">{isFestivalSubmitting ? '提交中...' : `确认提交 (¥${festivalPlan})`}</button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
