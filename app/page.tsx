'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Plus, Sparkles, CheckSquare, Square, Trash2, 
  Clock, Calendar, AlertTriangle, CheckCircle, MessageSquare, Send, 
  Mic, MicOff, Volume2, VolumeX, Mail, ArrowRight, User, Settings, 
  TrendingUp, BarChart2, PieChart, Star, ListCollapse, ChevronRight,
  RefreshCw, Info, HelpCircle, FileText, Clipboard, Copy, Check, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface SubTask {
  id: string;
  title: string;
  duration: number; // in hours
  completed: boolean;
  description: string;
  phase: number;
}

interface Task {
  id: string;
  title: string;
  description: string;
  category: 'Work' | 'Study' | 'Personal' | 'Health';
  priority: 'Q1' | 'Q2' | 'Q3' | 'Q4'; // Eisenhower Matrix
  duration: number; // estimated hours
  completed: boolean;
  deadline: string; // YYYY-MM-DD
  subtasks: SubTask[];
  actualDuration?: number; // actual hours taken
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  type: 'meeting' | 'focus' | 'break' | 'personal';
  taskId?: string; // linked task
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

// Pure helpers defined outside of React component scope to satisfy strict ESLint rules
function generateId(prefix: string): string {
  const rand = Math.floor(Math.random() * 10000000);
  const timestamp = typeof Date !== 'undefined' ? Date.now() : 0;
  return `${prefix}-${timestamp}-${rand}`;
}

function getFutureDateString(daysAhead: number): string {
  return new Date(Date.now() + 86400000 * daysAhead).toISOString().split('T')[0];
}

export default function HelpingHand() {
  // --- Persistent States (with LocalStorage) ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [persona, setPersona] = useState<string>('Balanced Achiever');
  const [workStart, setWorkStart] = useState<string>('09:00');
  const [workEnd, setWorkEnd] = useState<string>('17:00');
  const [procrastinationBuffer, setProcrastinationBuffer] = useState<number>(1.0); // buffer multiplier
  const [totalCompletedHours, setTotalCompletedHours] = useState<number>(0);
  const [habitsStreak, setHabitsStreak] = useState<number>(5); // simulated default streak

  // --- UI Interactive States ---
  const [activeTab, setActiveTab] = useState<'cockpit' | 'tasks' | 'calendar' | 'analytics'>('cockpit');
  const [chatInput, setChatInput] = useState<string>('');
  const [isCoachTyping, setIsCoachTyping] = useState<boolean>(false);
  
  // New Task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<'Work' | 'Study' | 'Personal' | 'Health'>('Work');
  const [newTaskPriority, setNewTaskPriority] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q2');
  const [newTaskDuration, setNewTaskDuration] = useState('2');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  // Active Focus Session state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(1500); // 25 mins standard pomodoro
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [focusLogs, setFocusLogs] = useState<{ id: string; date: string; hours: number }[]>([]);

  // Email Draft state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTask, setEmailTask] = useState<Task | null>(null);
  const [emailType, setEmailType] = useState<'extension' | 'report' | 'followup'>('extension');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailContext, setEmailContext] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [copied, setCopied] = useState(false);

  // Voice Assistant states
  const [isListening, setIsListening] = useState<boolean>(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [voiceNotification, setVoiceNotification] = useState<string | null>(null);

  // Loading indicator for breakdown
  const [breakingTaskId, setBreakingTaskId] = useState<string | null>(null);
  const [isRebuildingSchedule, setIsRebuildingSchedule] = useState<boolean>(false);

  // Time-of-day clock state
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Error banners
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const idCounterRef = useRef<number>(100);

  // Toast notifications helper
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- Persistent Storage Sync ---
  const updateTasksState = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    localStorage.setItem('helpinghand_tasks', JSON.stringify(updatedTasks));
  };

  const updateEventsState = (updatedEvents: CalendarEvent[]) => {
    setCalendarEvents(updatedEvents);
    localStorage.setItem('helpinghand_events', JSON.stringify(updatedEvents));
  };

  const updateMessagesState = (updatedMsgs: ChatMessage[]) => {
    setMessages(updatedMsgs);
    localStorage.setItem('helpinghand_messages', JSON.stringify(updatedMsgs));
  };

  // --- Date & Time Calculation Helpers ---
  const getDaysRemaining = (deadlineDateStr: string): number => {
    if (!deadlineDateStr) return 5;
    const deadline = new Date(deadlineDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    deadline.setHours(0,0,0,0);
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getAdjustedDuration = (task: Task): number => {
    const rawDuration = task.duration;
    let multiplier = procrastinationBuffer;
    if (task.subtasks && task.subtasks.length > 0) {
      const completedSub = task.subtasks.filter(s => s.completed).length;
      if (completedSub > 0 && completedSub < task.subtasks.length) {
        multiplier *= 1.15;
      }
    }
    return Math.round((rawDuration * multiplier) * 10) / 10;
  };

  // --- Task Completion and Clock-out Operations ---
  const toggleTaskCompletion = (taskId: string) => {
    const nextTasks = tasks.map(t => {
      if (t.id === taskId) {
        const isNowCompleted = !t.completed;
        if (isNowCompleted) {
          setTotalCompletedHours(prev => prev + getAdjustedDuration(t));
          localStorage.setItem('helpinghand_completed_hours', (totalCompletedHours + getAdjustedDuration(t)).toString());
          triggerToast(`Completed: ${t.title}! +${getAdjustedDuration(t)} hours logged.`);
        }
        return { ...t, completed: isNowCompleted };
      }
      return t;
    });
    updateTasksState(nextTasks);
  };

  function handleFocusTimerComplete() {
    setTimerRunning(false);
    if (activeTaskId) {
      const activeTaskObj = tasks.find(t => t.id === activeTaskId);
      if (activeTaskObj) {
        toggleTaskCompletion(activeTaskId);
      }
    }
    setActiveTaskId(null);
    triggerToast("Work landmark achieved! Focus cycle completed.");
    
    // Play subtle chime sound
    try {
      const context = new AudioContext();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.connect(gain);
      gain.connect(context.destination);
      osc.frequency.setValueAtTime(880, context.currentTime); // high chime A5
      gain.gain.setValueAtTime(0.1, context.currentTime);
      osc.start();
      osc.stop(context.currentTime + 0.3);
    } catch (e) {}
  }

  // --- Initializers & Time Tracker ---
  useEffect(() => {
    const initialTime = new Date();
    const timer = setTimeout(() => {
      setCurrentTime(initialTime);
    }, 0);
    const interval = setInterval(() => setCurrentTime(new Date()), 60000); // update every minute
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Hydrate from LocalStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedTasks = localStorage.getItem('helpinghand_tasks');
        const savedEvents = localStorage.getItem('helpinghand_events');
        const savedMessages = localStorage.getItem('helpinghand_messages');
        const savedPersona = localStorage.getItem('helpinghand_persona');
        const savedWorkStart = localStorage.getItem('helpinghand_workstart');
        const savedWorkEnd = localStorage.getItem('helpinghand_workend');
        const savedBuffer = localStorage.getItem('helpinghand_buffer');
        const savedCompletedHours = localStorage.getItem('helpinghand_completed_hours');
        const savedFocusLogs = localStorage.getItem('helpinghand_focus_logs');

        // Default seed tasks if empty
        if (savedTasks) {
          setTasks(JSON.parse(savedTasks));
        } else {
          const defaultTasks: Task[] = [
            {
              id: 'task-1',
              title: 'Design Helping Hand Interface',
              description: 'Draft typography pairings, glowing focus indicators, and custom SVG widgets.',
              category: 'Work',
              priority: 'Q1',
              duration: 3,
              completed: true,
              deadline: getFutureDateString(1), // tomorrow
              subtasks: [
                { id: 'sub-1', title: 'Research space-grotesk styling', duration: 0.5, completed: true, description: 'Find nice typography', phase: 1 },
                { id: 'sub-2', title: 'Layout bento grid', duration: 1.5, completed: true, description: 'Set up columns', phase: 2 },
                { id: 'sub-3', title: 'Implement custom SVG charts', duration: 1, completed: true, description: 'Code responsive rings', phase: 2 },
              ],
              actualDuration: 3.5
            },
            {
              id: 'task-2',
              title: 'Draft Project Thesis Proposal',
              description: 'Write the preliminary research outline and schedule supervisor checkpoints.',
              category: 'Study',
              priority: 'Q2',
              duration: 6,
              completed: false,
              deadline: getFutureDateString(3), // 3 days
              subtasks: []
            },
            {
              id: 'task-3',
              title: 'Audit System Deadline Risks',
              description: 'Analyze remaining deliverables against student calendar timeline.',
              category: 'Work',
              priority: 'Q3',
              duration: 2.5,
              completed: false,
              deadline: getFutureDateString(1), // tomorrow
              subtasks: []
            },
            {
              id: 'task-4',
              title: 'Practice Breathing & Mindfulness',
              description: '15-minute diaphragmatic breathing sequence to restore baseline parasympathetic tone.',
              category: 'Health',
              priority: 'Q4',
              duration: 0.5,
              completed: false,
              deadline: getFutureDateString(0), // today
              subtasks: []
            }
          ];
          setTasks(defaultTasks);
          localStorage.setItem('helpinghand_tasks', JSON.stringify(defaultTasks));
        }

        // Default seed events
        if (savedEvents) {
          setCalendarEvents(JSON.parse(savedEvents));
        } else {
          const defaultEvents: CalendarEvent[] = [
            { id: 'ev-1', title: 'System Standup Meeting', start: '10:00', end: '11:00', type: 'meeting' },
            { id: 'ev-2', title: 'AI Research Review', start: '14:30', end: '15:30', type: 'meeting' },
            { id: 'ev-3', title: 'Nutritional Re-energizer', start: '12:00', end: '13:00', type: 'break' },
          ];
          setCalendarEvents(defaultEvents);
          localStorage.setItem('helpinghand_events', JSON.stringify(defaultEvents));
        }

        // Default seed messages
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        } else {
          const defaultMessages: ChatMessage[] = [
            {
              id: 'msg-1',
              role: 'model',
              content: `Greetings! I am **Helping Hand**, your dedicated productivity strategist.

Unlike traditional planners, I don't just log tasks—I engineer solutions. Today, you have several critical landmarks:
- **1 Urgent & Important task** needs attention today.
- I've detected a **Deadline Risk** on your "Audit System Deadline Risks" task.

How can I assist your workflow? You can click **AI Breakdown** on any task to map its execution sequence, or prompt me via text or **Voice**!`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ];
          setMessages(defaultMessages);
          localStorage.setItem('helpinghand_messages', JSON.stringify(defaultMessages));
        }

        if (savedPersona) setPersona(savedPersona);
        if (savedWorkStart) setWorkStart(savedWorkStart);
        if (savedWorkEnd) setWorkEnd(savedWorkEnd);
        if (savedBuffer) setProcrastinationBuffer(parseFloat(savedBuffer));
        if (savedCompletedHours) setTotalCompletedHours(parseFloat(savedCompletedHours));
        
        if (savedFocusLogs) {
          setFocusLogs(JSON.parse(savedFocusLogs));
        } else {
          const defaultLogs = [
            { id: 'l-1', date: 'Mon', hours: 2.5 },
            { id: 'l-2', date: 'Tue', hours: 4.0 },
            { id: 'l-3', date: 'Wed', hours: 3.5 },
            { id: 'l-4', date: 'Thu', hours: 5.0 },
            { id: 'l-5', date: 'Fri', hours: 2.0 },
          ];
          setFocusLogs(defaultLogs);
          localStorage.setItem('helpinghand_focus_logs', JSON.stringify(defaultLogs));
        }

      } catch (e) {
        console.error("Hydration error:", e);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);



  // Keep chat scrolled to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isCoachTyping]);

  // Handle active focus timer tick
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            handleFocusTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning, activeTaskId]);

  // Speak feedback helper using SpeechSynthesis
  const speakVoice = (text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel(); // Stop active speaking
      // Strip markdown syntax for natural reading
      const cleanText = text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[-#*]/g, ' ');
      
      const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 200)); // Speak first 200 chars to avoid infinite monologue
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      
      // Select nice voice if available
      const voices = window.speechSynthesis.getVoices();
      const premiumVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Female'));
      if (premiumVoice) utterance.voice = premiumVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech Synthesis error:", e);
    }
  };

  // --- Core Algorithms & Models ---

  // 1. Task Prioritization Model
  // Urgency Quadrant (Q1 = 100, Q2 = 75, Q3 = 50, Q4 = 25)
  // Deadline Factor: Adds up to 50 points based on days remaining
  // Complexity Factor: Persona specific multiplier
  const getPriorityScore = (task: Task) => {
    let baseScore = 25;
    if (task.priority === 'Q1') baseScore = 100;
    else if (task.priority === 'Q2') baseScore = 75;
    else if (task.priority === 'Q3') baseScore = 50;

    const daysLeft = getDaysRemaining(task.deadline);
    let deadlineUrgency = 0;
    if (daysLeft <= 0) {
      deadlineUrgency = 55; // Overdue bonus urgency
    } else if (daysLeft <= 1) {
      deadlineUrgency = 45;
    } else if (daysLeft <= 3) {
      deadlineUrgency = 30;
    } else if (daysLeft <= 7) {
      deadlineUrgency = 15;
    }

    // Persona modifiers
    let personaModifier = 0;
    if (persona === 'Hyper-Focused Deep Worker' && task.priority === 'Q2') {
      personaModifier = 20; // values heavy Q2 strategy
    } else if (persona === 'Deadline Sprint Hero' && (task.priority === 'Q1' || task.priority === 'Q3')) {
      personaModifier = 25; // values immediate urgencies
    } else if (persona === 'Balanced Achiever' && task.category === 'Health') {
      personaModifier = 10; // encourages healthy routines
    }

    return baseScore + deadlineUrgency + personaModifier;
  };



  // 3. Deadline Risk Predictor
  // Safe: Work hours needed can easily fit into available days before deadline (load < 40%)
  // Medium: Work hours fit, but leaves little margin (load 40-75%)
  // Critical: Load > 75%, or deadline has passed
  const getDeadlineRisk = (task: Task): { score: number; level: 'Safe' | 'Medium' | 'Critical'; label: string } => {
    if (task.completed) return { score: 0, level: 'Safe', label: 'Completed' };
    
    const daysLeft = getDaysRemaining(task.deadline);
    const hoursNeeded = getAdjustedDuration(task);

    if (daysLeft <= 0) {
      return { score: 100, level: 'Critical', label: 'Overdue / Imminent' };
    }

    // Assumes typical 6 productive hours available per day
    const availableWorkHours = daysLeft * 6;
    const load = (hoursNeeded / availableWorkHours) * 100;

    if (load > 85) {
      return { score: Math.min(100, Math.round(load)), level: 'Critical', label: 'Extremely High Risk' };
    } else if (load > 40) {
      return { score: Math.round(load), level: 'Medium', label: 'Moderate Risk' };
    } else {
      return { score: Math.max(5, Math.round(load)), level: 'Safe', label: 'Safe Runway' };
    }
  };

  // 4. Context Engine - "What is the Best Next Action right now?"
  const getBestNextAction = (): { task: Task | null; reason: string } => {
    const incompleteTasks = tasks.filter(t => !t.completed);
    if (incompleteTasks.length === 0) {
      return { task: null, reason: "Excellent job! All tasks in your scope are complete. Focus on recovery." };
    }

    // Sort by priority score
    const sorted = [...incompleteTasks].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
    const primeCandidate = sorted[0];

    // Determine reason based on context
    const hours = currentTime ? currentTime.getHours() : 10;
    const daysLeft = getDaysRemaining(primeCandidate.deadline);

    let reason = "";
    if (daysLeft <= 1) {
      reason = `This task is due soon (${daysLeft === 0 ? 'Today' : 'Tomorrow'}) and represents the ultimate priority checkpoint.`;
    } else if (primeCandidate.priority === 'Q1') {
      reason = "Classified as both Urgent and Important (Q1)—tackling this removes substantial system drag.";
    } else if (hours < 12 && persona === 'Hyper-Focused Deep Worker') {
      reason = "As a Hyper-Focused Deep Worker, your peak morning hours are best spent on your most demanding Q2 task.";
    } else {
      reason = "Recommended by the AI Prioritization Engine based on workload complexity and deadlines.";
    }

    return { task: primeCandidate, reason };
  };

  // --- Dynamic Scheduler Action ---
  // Slotes active tasks into the typical workday schedule, leaving room for pre-existing Calendar Events.
  const handleRebuildSchedule = () => {
    setIsRebuildingSchedule(true);
    
    setTimeout(() => {
      // Rebuild timeline blocks
      const updatedEvents = calendarEvents.filter(e => e.type === 'meeting' || e.type === 'break');
      const incompleteTasks = tasks
        .filter(t => !t.completed)
        .sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

      let currentHour = parseInt(workStart.split(':')[0]);
      let currentMin = parseInt(workStart.split(':')[1]);
      const endHour = parseInt(workEnd.split(':')[0]);

      // Create dummy task timeline allocations
      const newlyScheduled: CalendarEvent[] = [];
      let taskIdx = 0;

      while (currentHour < endHour && taskIdx < incompleteTasks.length) {
        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
        
        // Check if there's a meeting conflict in this slot (duration 1 hour block simulated)
        const conflict = updatedEvents.find(e => {
          const sHour = parseInt(e.start.split(':')[0]);
          const eHour = parseInt(e.end.split(':')[0]);
          return currentHour >= sHour && currentHour < eHour;
        });

        if (conflict) {
          currentHour = parseInt(conflict.end.split(':')[0]);
          currentMin = parseInt(conflict.end.split(':')[1]);
          continue;
        }

        const task = incompleteTasks[taskIdx];
        const taskDuration = getAdjustedDuration(task);
        const allocatedHours = Math.min(1.5, taskDuration); // Max 1.5h chunks for dynamic pacing

        const endSlotHour = currentHour + Math.floor(allocatedHours);
        const endSlotMin = currentMin + (allocatedHours % 1) * 60;
        
        const endSlotHourFinal = endSlotMin >= 60 ? endSlotHour + 1 : endSlotHour;
        const endSlotMinFinal = endSlotMin % 60;

        const startStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
        const endStr = `${String(endSlotHourFinal).padStart(2, '0')}:${String(endSlotMinFinal).padStart(2, '0')}`;

        newlyScheduled.push({
          id: `sched-${task.id}-${taskIdx}`,
          title: `Focus: ${task.title}`,
          start: startStr,
          end: endStr,
          type: 'focus',
          taskId: task.id
        });

        taskIdx++;
        currentHour = endSlotHourFinal;
        currentMin = endSlotMinFinal;
      }

      const merged = [...updatedEvents, ...newlyScheduled];
      updateEventsState(merged);
      setIsRebuildingSchedule(false);
      triggerToast("AI successfully rebuilt schedule with optimized focus times!");
    }, 1200);
  };



  // --- Task Operations ---
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const deadlineVal = newTaskDeadline || getFutureDateString(2);

    const added: Task = {
      id: generateId('task'),
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      category: newTaskCategory,
      priority: newTaskPriority,
      duration: parseFloat(newTaskDuration) || 1,
      completed: false,
      deadline: deadlineVal,
      subtasks: []
    };

    const nextTasks = [added, ...tasks];
    updateTasksState(nextTasks);
    triggerToast(`Task "${added.title}" added to companion vault.`);

    // Reset Form
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskCategory('Work');
    setNewTaskPriority('Q2');
    setNewTaskDuration('2');
    setNewTaskDeadline('');
  };



  const toggleSubtaskCompletion = (taskId: string, subtaskId: string) => {
    const nextTasks = tasks.map(t => {
      if (t.id === taskId) {
        const nextSubs = t.subtasks.map(s => {
          if (s.id === subtaskId) return { ...s, completed: !s.completed };
          return s;
        });
        return { ...t, subtasks: nextSubs };
      }
      return t;
    });
    updateTasksState(nextTasks);
  };

  const handleDeleteTask = (taskId: string) => {
    const nextTasks = tasks.filter(t => t.id !== taskId);
    updateTasksState(nextTasks);
    if (activeTaskId === taskId) {
      handleStopFocusSession();
    }
    triggerToast("Task permanently deleted from vault.");
  };

  // --- AI Reverse Planning: Breakdown Task ---
  const handleAIBreakdown = async (task: Task) => {
    if (task.completed) return;
    setBreakingTaskId(task.id);
    setApiError(null);

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'breakdown',
          payload: {
            taskTitle: task.title,
            taskDescription: task.description,
            totalHours: task.duration
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate breakdown");

      const subtasks: SubTask[] = data.result.map((s: any, idx: number) => ({
        id: `sub-${Date.now()}-${idx}`,
        title: s.title,
        duration: s.duration || 1,
        completed: false,
        description: s.description || '',
        phase: s.phase || 1
      }));

      // Update task with subtasks
      const nextTasks = tasks.map(t => {
        if (t.id === task.id) {
          return { ...t, subtasks };
        }
        return t;
      });
      updateTasksState(nextTasks);
      triggerToast(`AI segmented "${task.title}" into ${subtasks.length} strategic milestones!`);
      
      if (ttsEnabled) {
        speakVoice(`I have reverse planned ${task.title} into ${subtasks.length} strategic milestones.`);
      }

    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Network breakdown error");
      if (err.message?.includes("GEMINI_API_KEY")) {
        setApiKeyMissing(true);
      }
    } finally {
      setBreakingTaskId(null);
    }
  };

  // --- Active Focus Timer System ---
  const handleStartFocusSession = (task: Task) => {
    setActiveTaskId(task.id);
    setTimerSeconds(Math.round(getAdjustedDuration(task) * 3600)); // Total seconds for entire task
    setTimerRunning(true);
    triggerToast(`Deep Work Protocol initiated for "${task.title}".`);
    
    if (ttsEnabled) {
      speakVoice(`Initiating deep work session for ${task.title}. Total adjusted time blocks mapped.`);
    }
  };

  const handleStopFocusSession = () => {
    setTimerRunning(false);
    setActiveTaskId(null);
  };



  // --- AI Coaching Chat Module ---
  const handleSendChat = async (inputStr?: string) => {
    const textToSend = inputStr || chatInput;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: generateId('msg'),
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextMessages = [...messages, userMsg];
    updateMessagesState(nextMessages);
    setChatInput('');
    setIsCoachTyping(true);
    setApiError(null);

    // Context summary for personalized coach replies
    const nextAction = getBestNextAction();
    const currentContext = {
      activeTask: nextAction.task,
      tasksCount: tasks.filter(t => !t.completed).length,
      totalWorkload: tasks.filter(t => !t.completed).reduce((sum, t) => sum + getAdjustedDuration(t), 0),
      highRiskCount: tasks.filter(t => !t.completed && getDeadlineRisk(t).level === 'Critical').length,
      persona: persona
    };

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'coach',
          payload: {
            messages: nextMessages.slice(-8), // send last 8 messages for memory
            currentContext: currentContext
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Coach integration failed");

      const coachMsg: ChatMessage = {
        id: generateId('msg'),
        role: 'model',
        content: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      updateMessagesState([...nextMessages, coachMsg]);
      speakVoice(data.text);

    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Coach API connection offline");
      if (err.message?.includes("GEMINI_API_KEY")) {
        setApiKeyMissing(true);
      }
    } finally {
      setIsCoachTyping(false);
    }
  };

  // Quick prompt chips
  const handleQuickPrompt = (promptText: string) => {
    handleSendChat(promptText);
  };

  // --- Google Calendar & Gmail Helpers ---
  const handleOpenEmailDialog = (task: Task) => {
    setEmailTask(task);
    setEmailType('extension');
    setEmailRecipient('Supervisor / Lead');
    setEmailContext('Required extra precision mapping architectural dependencies and debugging type resolutions');
    setEmailDraft('');
    setIsEmailModalOpen(true);
  };

  const handleGenerateEmail = async () => {
    if (!emailTask) return;
    setIsGeneratingEmail(true);
    setApiError(null);

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'email',
          payload: {
            emailType,
            taskTitle: emailTask.title,
            recipient: emailRecipient,
            contextInfo: emailContext
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Email drafting offline");

      setEmailDraft(data.text);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Email drafting offline");
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleCopyEmail = () => {
    if (!emailDraft) return;
    navigator.clipboard.writeText(emailDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    triggerToast("Email draft copied to system clipboard!");
  };

  // --- Voice Assistant (Browser Speech Recognition) ---
  const startSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      triggerToast("Web Speech API not supported in this browser version.");
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Mute coach speaking when listening
      const rec = new SpeechRecognition();
      recognitionRef.current = rec;
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setVoiceNotification("Helping Hand: Listening to your voice protocol...");
      };

      rec.onerror = (e: any) => {
        console.error("Speech Recognition error:", e);
        setIsListening(false);
        setVoiceNotification(null);
        triggerToast("Voice recording timed out or failed permission.");
      };

      rec.onend = () => {
        setIsListening(false);
        setVoiceNotification(null);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceNotification(`Heard: "${transcript}"`);
        setTimeout(() => setVoiceNotification(null), 2500);
        
        // Custom parser for local voice commands
        const lowerTranscript = transcript.toLowerCase();
        
        if (lowerTranscript.includes("what is next") || lowerTranscript.includes("what's next") || lowerTranscript.includes("next task")) {
          const bAction = getBestNextAction();
          if (bAction.task) {
            const resp = `Your recommended next focus landmark is: "${bAction.task.title}". Estimated work required is ${getAdjustedDuration(bAction.task)} hours. Let me know if I should plan its breakdown.`;
            addSimulatedCoachMessage(transcript, resp);
          } else {
            addSimulatedCoachMessage(transcript, "All task horizons are clear. No pending items currently logged.");
          }
        } else if (lowerTranscript.includes("start focus") || lowerTranscript.includes("start timer")) {
          const bAction = getBestNextAction();
          if (bAction.task) {
            handleStartFocusSession(bAction.task);
            addSimulatedCoachMessage(transcript, `Deep Work initiated for "${bAction.task.title}". The countdown is live.`);
          } else {
            addSimulatedCoachMessage(transcript, "No active tasks are registered to sync with the timer.");
          }
        } else if (lowerTranscript.includes("rebuild schedule") || lowerTranscript.includes("optimize schedule")) {
          handleRebuildSchedule();
          addSimulatedCoachMessage(transcript, "Rebuilding and optimizing your dynamic calendar timeline now.");
        } else {
          // Standard pipeline: send to Gemini Coach
          setChatInput(transcript);
          // Auto send chat
          setTimeout(() => {
            handleSendChat(transcript);
          }, 200);
        }
      };

      rec.start();
    } catch (e) {
      console.error("Speech setup error:", e);
    }
  };

  const addSimulatedCoachMessage = (userText: string, coachText: string) => {
    idCounterRef.current += 1;
    const userMsgId = `msg-sim-${idCounterRef.current}`;
    idCounterRef.current += 1;
    const coachMsgId = `msg-sim-${idCounterRef.current}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const coachMsg: ChatMessage = {
      id: coachMsgId,
      role: 'model',
      content: coachText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    updateMessagesState([...messages, userMsg, coachMsg]);
    speakVoice(coachText);
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setVoiceNotification(null);
    }
  };

  // Procrastination audit logger
  const handleLogProcrastination = () => {
    const newVal = Math.round((procrastinationBuffer + 0.15) * 100) / 100;
    setProcrastinationBuffer(newVal);
    localStorage.setItem('helpinghand_buffer', newVal.toString());
    triggerToast(`Buffer adjusted to ${newVal}x. Task timelines lengthened automatically.`);
    addSimulatedCoachMessage(
      "Log procrastination cycle",
      `Understood. I have logged this procrastination instance. Your global Task Estimation Buffer has been increased to **${newVal}x**. Big tasks will now allocate more focus runway to minimize completion stress.`
    );
  };

  const handleResetBuffer = () => {
    setProcrastinationBuffer(1.0);
    localStorage.setItem('helpinghand_buffer', '1.0');
    triggerToast("Buffer calibrated to baseline 1.0x.");
  };

  // Math variables for rendering widgets
  const nextRecommended = getBestNextAction();
  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.filter(t => !t.completed).length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  
  const estimatedHoursLeft = tasks
    .filter(t => !t.completed)
    .reduce((sum, t) => sum + getAdjustedDuration(t), 0);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white py-2.5 px-5 rounded-xl shadow-xl backdrop-blur-md flex items-center gap-2 border border-slate-700 max-w-md text-sm font-medium"
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Assistant Notification Overlay */}
      <AnimatePresence>
        {voiceNotification && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 bg-indigo-950/95 text-white py-3.5 px-6 rounded-2xl shadow-2xl backdrop-blur-md border border-indigo-500/30 flex items-center gap-3.5 max-w-sm"
          >
            <div className="relative">
              <div className="w-3.5 h-3.5 bg-indigo-500 rounded-full animate-ping absolute" />
              <div className="w-3.5 h-3.5 bg-indigo-400 rounded-full" />
            </div>
            <p className="text-sm font-medium text-indigo-100">{voiceNotification}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Missing Alert Bar */}
      {apiKeyMissing && (
        <div className="bg-amber-50 border-b border-amber-200 py-2.5 px-4 text-center">
          <p className="text-sm text-amber-800 font-medium flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>AI functions are currently operating in offline backup mode. Configure your <strong>GEMINI_API_KEY</strong> in the Secrets panel to activate full capabilities.</span>
          </p>
        </div>
      )}

      {/* Navigation Header */}
      <nav className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">Helping<span className="text-indigo-600">Hand</span></span>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Aesthetic search input matching the theme */}
          <div className="hidden md:flex bg-slate-100 rounded-full px-4 py-1.5 border border-slate-200">
            <Search className="w-4 h-4 text-slate-400 mt-0.5 mr-2 shrink-0" />
            <input 
              type="text" 
              placeholder="Ask Helping Hand..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              className="bg-transparent border-none text-sm focus:outline-none focus:ring-0 w-64" 
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Persona Select */}
            <select 
              value={persona}
              onChange={(e) => {
                setPersona(e.target.value);
                localStorage.setItem('helpinghand_persona', e.target.value);
                triggerToast(`Productivity strategy optimized for: ${e.target.value}`);
              }}
              className="text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-900 py-1.5 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Balanced Achiever">Balanced Achiever</option>
              <option value="Hyper-Focused Deep Worker">Hyper-Focused</option>
              <option value="Deadline Sprint Hero">Deadline Sprinter</option>
              <option value="Night Owl Planner">Night Owl</option>
            </select>

            {/* TTS Toggle */}
            <button 
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={`p-2 rounded-lg border transition-all ${ttsEnabled ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
              title={ttsEnabled ? "Mute Voice Assistant" : "Unmute Voice Assistant"}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Profile badge */}
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-semibold text-xs text-center">S</div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Aside) from Sleek Interface design */}
        <aside className="hidden lg:flex w-72 border-r border-slate-200 bg-white flex flex-col shrink-0 p-6 overflow-y-auto">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Today&apos;s Schedule</h2>
          <div className="space-y-6 flex-1">
            {calendarEvents && calendarEvents.length > 0 ? (
              calendarEvents
                .sort((a, b) => a.start.localeCompare(b.start))
                .slice(0, 4)
                .map((ev, idx) => {
                  const isFocus = ev.type === 'focus';
                  const isMeeting = ev.type === 'meeting';
                  
                  let colorClass = "border-l-4 border-slate-300";
                  let textBg = "bg-slate-50";
                  let titleColor = "text-slate-800";
                  let subtitleColor = "text-slate-500";
                  
                  if (isFocus) {
                    colorClass = "border-l-4 border-indigo-500";
                    textBg = "bg-indigo-50";
                    titleColor = "text-indigo-900";
                    subtitleColor = "text-indigo-700";
                  } else if (isMeeting) {
                    colorClass = "border-l-4 border-amber-500";
                    textBg = "bg-amber-50";
                    titleColor = "text-amber-900";
                    subtitleColor = "text-amber-700";
                  } else {
                    colorClass = "border-l-4 border-emerald-500";
                    textBg = "bg-emerald-50";
                    titleColor = "text-emerald-900";
                    subtitleColor = "text-emerald-700";
                  }
                  
                  return (
                    <div key={ev.id || idx} className="flex gap-4">
                      <div className="text-xs text-slate-400 font-medium w-10 py-1">{ev.start}</div>
                      <div className={`flex-1 p-3 ${textBg} ${colorClass} rounded-r-lg`}>
                        <p className={`text-xs font-bold ${titleColor} truncate`}>{ev.title}</p>
                        <p className={`text-[10px] font-medium ${subtitleColor}`}>{ev.start} - {ev.end}</p>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="text-xs text-slate-400 font-medium w-10 py-1">09:00</div>
                  <div className="flex-1 p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-lg">
                    <p className="text-xs font-bold text-indigo-900">Deep Focus Sprint</p>
                    <p className="text-[10px] font-medium text-indigo-700">09:00 - 11:30</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-xs text-slate-400 font-medium w-10 py-1">11:30</div>
                  <div className="flex-1 p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
                    <p className="text-xs font-bold text-amber-900">Landmark Status Sync</p>
                    <p className="text-[10px] font-medium text-amber-700">11:30 - 12:00</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-xs text-slate-400 font-medium w-10 py-1">13:00</div>
                  <div className="flex-1 p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg">
                    <p className="text-xs font-bold text-emerald-900">Lunch & Recovery</p>
                    <p className="text-[10px] font-medium text-emerald-700">13:00 - 14:00</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-xs text-slate-400 font-medium w-10 py-1">14:00</div>
                  <div className="flex-1 p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-lg">
                    <p className="text-xs font-bold text-indigo-900">UI Sleek Theme Design</p>
                    <p className="text-[10px] font-medium text-indigo-700">14:00 - 16:30</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-auto pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Productivity Score</span>
              <span className="text-sm font-extrabold text-indigo-600">
                {tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 88}%
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-500" 
                style={{ width: `${tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 88}%` }}
              />
            </div>
          </div>
        </aside>

        {/* Center/Main Content area */}
        <section className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 flex flex-col">
          
          {/* Header inside center */}
          <header className="flex items-end justify-between mb-8 shrink-0">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Good morning, Shreya.</h1>
              <p className="text-slate-500 mt-1">Helping Hand has prepared your optimal path for today.</p>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-sm font-semibold px-4 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-slate-600">
                {currentTime ? currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Loading schedule...'}
              </span>
            </div>
          </header>

          {/* Tab Navigation header inside center for non-desktop to make it accessible */}
          <div className="lg:hidden flex bg-white border border-slate-200 rounded-xl p-1 mb-6 gap-1 shrink-0 shadow-sm">
            <button onClick={() => setActiveTab('cockpit')} className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold ${activeTab === 'cockpit' ? 'bg-indigo-50 text-indigo-900 font-bold' : 'text-slate-600'}`}>Cockpit</button>
            <button onClick={() => setActiveTab('tasks')} className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold ${activeTab === 'tasks' ? 'bg-indigo-50 text-indigo-900 font-bold' : 'text-slate-600'}`}>Vault</button>
            <button onClick={() => setActiveTab('calendar')} className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold ${activeTab === 'calendar' ? 'bg-indigo-50 text-indigo-900 font-bold' : 'text-slate-600'}`}>Calendar</button>
            <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold ${activeTab === 'analytics' ? 'bg-indigo-50 text-indigo-900 font-bold' : 'text-slate-600'}`}>Stats</button>
          </div>

          {/* Desktop header sub-tab bar inside center to let them switch tabs easily */}
          <div className="hidden lg:flex border-b border-slate-200 mb-6 shrink-0 gap-6">
            <button onClick={() => setActiveTab('cockpit')} className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'cockpit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Cockpit Dashboard</button>
            <button onClick={() => setActiveTab('tasks')} className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'tasks' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Task Vault</button>
            <button onClick={() => setActiveTab('calendar')} className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'calendar' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Optimizer Calendar</button>
            <button onClick={() => setActiveTab('analytics')} className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'analytics' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Analytics Suite</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
            
            {/* --- MAIN CENTRAL WORKSPACE (Cols: 8) --- */}
            <div className="lg:col-span-8 flex flex-col gap-6">

            {/* TAB 1: COCKPIT VIEW */}
            {activeTab === 'cockpit' && (
              <>
                {/* GLOWING HELPING HAND CONTEXT dial */}
                <div className="relative bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 rounded-3xl p-6 text-white shadow-2xl border border-indigo-500/20 overflow-hidden">
                  
                  {/* Glowing background flares */}
                  <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-10 left-10 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 z-10">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <span className="text-xs uppercase tracking-wider font-bold text-indigo-300">Context Engine Active</span>
                      </div>
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2">Your Recommended Focus Landmark</h2>
                      
                      {nextRecommended.task ? (
                        <>
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <h3 className="font-semibold text-lg text-indigo-100">{nextRecommended.task.title}</h3>
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
                                {nextRecommended.task.category}
                              </span>
                            </div>
                            <p className="text-sm text-slate-300 mb-3">{nextRecommended.task.description}</p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {getAdjustedDuration(nextRecommended.task)}h allocated</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-amber-400" /> 
                                Due {getDaysRemaining(nextRecommended.task.deadline) === 0 ? 'Today' : `in ${getDaysRemaining(nextRecommended.task.deadline)} days`}
                              </span>
                              <span className="flex items-center gap-1 font-semibold text-indigo-300">
                                Prioritization Score: {getPriorityScore(nextRecommended.task)}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-xs text-slate-400 italic flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{nextRecommended.reason}</span>
                          </p>
                        </>
                      ) : (
                        <div className="p-4 text-center bg-slate-900/50 rounded-xl">
                          <p className="text-slate-400 text-sm">No incomplete tasks registered inside your companion vault.</p>
                        </div>
                      )}
                    </div>

                    {/* FOCUS TIMER CARD */}
                    <div className="w-full md:w-auto shrink-0 bg-slate-900/85 border border-white/10 rounded-2xl p-5 flex flex-col items-center min-w-[200px] shadow-lg">
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Deep Focus Loop</span>
                      
                      {activeTaskId ? (
                        <div className="text-center">
                          <div className="text-3xl md:text-4xl font-mono font-bold text-white tracking-widest mb-3">
                            {formatTime(timerSeconds)}
                          </div>
                          <div className="flex items-center justify-center gap-3">
                            <button 
                              onClick={() => setTimerRunning(!timerRunning)}
                              className={`p-2.5 rounded-full transition-all ${timerRunning ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600 text-white'}`}
                              title={timerRunning ? "Pause timer" : "Resume timer"}
                            >
                              {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={handleStopFocusSession}
                              className="p-2.5 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white transition-all"
                              title="Exit focus cycle"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-2 flex flex-col items-center">
                          <Clock className="w-10 h-10 text-indigo-400/50 animate-pulse mb-2" />
                          <p className="text-xs text-slate-400 mb-3 max-w-[150px] mx-auto">Select any task below to initiate deep focus.</p>
                          {nextRecommended.task && (
                            <button
                              onClick={() => handleStartFocusSession(nextRecommended.task!)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-700/30"
                            >
                              <Play className="w-3.5 h-3.5" /> Start Focus Now
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* TODAY TIMELINE VIEW */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">Today&apos;s Optimized Schedule</h2>
                      <p className="text-xs text-slate-500">AI-generated slots mapped to avoid meeting conflicts and maximize deep focus</p>
                    </div>

                    <button
                      onClick={handleRebuildSchedule}
                      disabled={isRebuildingSchedule}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRebuildingSchedule ? 'animate-spin' : ''}`} />
                      {isRebuildingSchedule ? 'Optimizing...' : 'Rebuild AI Schedule'}
                    </button>
                  </div>

                  <div className="space-y-3 relative before:absolute before:top-2 before:bottom-2 before:left-14 before:w-0.5 before:bg-slate-100">
                    {calendarEvents
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map((ev, idx) => {
                        const isFocus = ev.type === 'focus';
                        const isMeeting = ev.type === 'meeting';
                        const isBreak = ev.type === 'break';

                        return (
                          <div key={ev.id || idx} className="flex gap-4 items-center">
                            {/* Time sidebar label */}
                            <span className="w-10 text-right font-mono text-xs font-semibold text-slate-400 shrink-0">{ev.start}</span>
                            
                            {/* Timeline Slot Card */}
                            <div className={`flex-1 p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                              isFocus 
                                ? 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-200' 
                                : isMeeting 
                                  ? 'bg-amber-50/40 border-amber-100 hover:border-amber-200' 
                                  : 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-200'
                            }`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full ${
                                  isFocus ? 'bg-indigo-500' : isMeeting ? 'bg-amber-500' : 'bg-emerald-500'
                                }`} />
                                <div>
                                  <h4 className="font-semibold text-sm text-slate-800">{ev.title}</h4>
                                  <p className="text-xs text-slate-400 font-medium">Slot Runway: {ev.start} - {ev.end}</p>
                                </div>
                              </div>

                              {isFocus && ev.taskId && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      const tObj = tasks.find(t => t.id === ev.taskId);
                                      if (tObj) handleStartFocusSession(tObj);
                                    }}
                                    className="p-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold transition-all"
                                    title="Start focus timer for this block"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => toggleTaskCompletion(ev.taskId!)}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all"
                                    title="Mark completed"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* HIGH RISK DEADLINES BANNER */}
                {tasks.filter(t => !t.completed && getDeadlineRisk(t).level === 'Critical').length > 0 && (
                  <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 flex items-start gap-4">
                    <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-rose-900 tracking-tight text-sm">Critical Deadline Overlap Warning</h4>
                      <p className="text-xs text-rose-700 mb-3 font-medium">
                        Your companion predicts that at your current velocity, you have a high probability of missing deadlines on the following tasks:
                      </p>
                      <div className="space-y-1.5">
                        {tasks.filter(t => !t.completed && getDeadlineRisk(t).level === 'Critical').map(t => (
                          <div key={t.id} className="flex items-center justify-between bg-white border border-rose-200/55 rounded-xl py-1.5 px-3 text-xs">
                            <span className="font-semibold text-rose-950">{t.title}</span>
                            <div className="flex items-center gap-2 text-rose-800 font-bold">
                              <span>Risk: {getDeadlineRisk(t).score}%</span>
                              <button 
                                onClick={() => handleOpenEmailDialog(t)}
                                className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-rose-100 hover:bg-rose-200 rounded text-rose-800 font-bold uppercase tracking-wider"
                              >
                                <Mail className="w-3 h-3" /> Draft Extension Email
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: TASKS VIEW */}
            {activeTab === 'tasks' && (
              <div className="flex flex-col gap-6">
                
                {/* Task Adding Form Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-lg mb-4 tracking-tight flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-500" /> Log Task in Vault
                  </h3>

                  <form onSubmit={handleAddTask} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-8 flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Task Landmark Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g., Finalize project documentation layout"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        required
                      />
                    </div>

                    <div className="md:col-span-4 flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Deadline Date</label>
                      <input 
                        type="date"
                        value={newTaskDeadline}
                        onChange={(e) => setNewTaskDeadline(e.target.value)}
                        className="p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-medium"
                      />
                    </div>

                    <div className="md:col-span-12 flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Detailed Description (Optional)</label>
                      <textarea 
                        placeholder="Provide details about delivery items, resources, or notes..."
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.target.value)}
                        rows={2}
                        className="p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>

                    <div className="md:col-span-3 flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                      <select 
                        value={newTaskCategory}
                        onChange={(e: any) => setNewTaskCategory(e.target.value)}
                        className="p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                      >
                        <option value="Work">💼 Work</option>
                        <option value="Study">📚 Study</option>
                        <option value="Personal">🏡 Personal</option>
                        <option value="Health">🧘 Health</option>
                      </select>
                    </div>

                    <div className="md:col-span-5 flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        Quadrant (Eisenhower)
                        <span title="Q1: Urgent & Important, Q2: Important, Q3: Urgent but Not Important, Q4: Neither">
                          <HelpCircle className="w-3 h-3 text-slate-400 cursor-help" />
                        </span>
                      </label>
                      <select 
                        value={newTaskPriority}
                        onChange={(e: any) => setNewTaskPriority(e.target.value)}
                        className="p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                      >
                        <option value="Q1">Q1: Urgent & Important</option>
                        <option value="Q2">Q2: Important, Not Urgent</option>
                        <option value="Q3">Q3: Urgent, Not Important</option>
                        <option value="Q4">Q4: Neither (Routine/Lag)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Est. Hours</label>
                      <input 
                        type="number" 
                        step="0.5"
                        min="0.5"
                        value={newTaskDuration}
                        onChange={(e) => setNewTaskDuration(e.target.value)}
                        className="p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium font-mono"
                      />
                    </div>

                    <div className="md:col-span-2 flex items-end">
                      <button 
                        type="submit"
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs tracking-wide transition-all shadow-md shadow-indigo-100 cursor-pointer"
                      >
                        Add Task
                      </button>
                    </div>
                  </form>
                </div>

                {/* TASK VAULT LISTINGS */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg tracking-tight">Active Productivity Vault ({pendingCount} pending)</h3>
                      <p className="text-xs text-slate-500">Sorted by AI Prioritization scores. Click breakdown to unlock granular reverse planning blocks.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {tasks.map((task) => {
                      const isBreaking = breakingTaskId === task.id;
                      const adjustedHours = getAdjustedDuration(task);
                      const priorityScore = getPriorityScore(task);
                      const risk = getDeadlineRisk(task);

                      return (
                        <div 
                          key={task.id} 
                          className={`bg-white border rounded-3xl p-5 shadow-sm transition-all relative overflow-hidden ${
                            task.completed ? 'opacity-65 border-slate-200' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Top indicator bar for risk levels */}
                          {!task.completed && (
                            <div className={`absolute top-0 left-0 right-0 h-1 ${
                              risk.level === 'Critical' ? 'bg-rose-500' : risk.level === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'
                            }`} />
                          )}

                          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <button 
                                  onClick={() => toggleTaskCompletion(task.id)}
                                  className="text-indigo-600 hover:text-indigo-500 shrink-0"
                                >
                                  {task.completed ? (
                                    <CheckSquare className="w-5 h-5 text-indigo-600 fill-indigo-50" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-400" />
                                  )}
                                </button>
                                
                                <h4 className={`font-bold text-base tracking-tight text-slate-900 ${task.completed ? 'line-through text-slate-400' : ''}`}>
                                  {task.title}
                                </h4>

                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                  task.category === 'Work' 
                                    ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                                    : task.category === 'Study' 
                                      ? 'bg-purple-50 text-purple-600 border border-purple-100' 
                                      : task.category === 'Health' 
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                        : 'bg-amber-50 text-amber-600 border border-amber-100'
                                }`}>
                                  {task.category}
                                </span>
                              </div>

                              <p className={`text-sm text-slate-600 mb-3 pl-7 ${task.completed ? 'text-slate-400' : ''}`}>
                                {task.description}
                              </p>

                              {/* Task metadata pills */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7 text-xs text-slate-400">
                                <span className="flex items-center gap-1 font-semibold text-indigo-600">
                                  <Star className="w-3.5 h-3.5 fill-indigo-50" /> Prioritization: {priorityScore}
                                </span>
                                <span className="flex items-center gap-1 font-semibold">
                                  <Clock className="w-3.5 h-3.5" /> Allocated: {adjustedHours}h {procrastinationBuffer > 1.0 && `(Buffer included)`}
                                </span>
                                <span className="flex items-center gap-1 font-semibold">
                                  <Calendar className="w-3.5 h-3.5" /> Due: {task.deadline}
                                </span>
                                {!task.completed && (
                                  <span className={`flex items-center gap-1 font-bold ${
                                    risk.level === 'Critical' ? 'text-rose-600' : risk.level === 'Medium' ? 'text-amber-600' : 'text-emerald-600'
                                  }`}>
                                    Risk: {risk.label} ({risk.score}%)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Interactive Actions Drawer on Right */}
                            <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 justify-end">
                              {!task.completed && (
                                <>
                                  <button
                                    onClick={() => handleAIBreakdown(task)}
                                    disabled={isBreaking}
                                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-50 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-100"
                                  >
                                    <Sparkles className={`w-3.5 h-3.5 ${isBreaking ? 'animate-spin text-indigo-400' : 'text-indigo-500'}`} />
                                    {isBreaking ? 'Planning...' : task.subtasks.length > 0 ? 'Regenerate Breakdown' : 'AI Breakdown'}
                                  </button>

                                  <button
                                    onClick={() => handleStartFocusSession(task)}
                                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                                  >
                                    <Play className="w-3.5 h-3.5" /> Focus Loop
                                  </button>

                                  <button
                                    onClick={() => handleOpenEmailDialog(task)}
                                    className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all"
                                    title="Draft professional email regarding this task"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1.5 border border-rose-100 hover:bg-rose-50 text-rose-600 rounded-xl transition-all"
                                title="Delete task permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Subtasks Accordion Render */}
                          {task.subtasks && task.subtasks.length > 0 && (
                            <div className="mt-4 pl-7 pt-4 border-t border-slate-100">
                              <h5 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2.5 flex items-center gap-1.5">
                                <ListCollapse className="w-3.5 h-3.5 text-indigo-500" /> AI Segmented Milestones (Reverse Plan)
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {task.subtasks.map((sub) => (
                                  <div 
                                    key={sub.id} 
                                    className={`p-3 rounded-2xl border transition-all flex items-start gap-2.5 ${
                                      sub.completed 
                                        ? 'bg-slate-50/50 border-slate-100 opacity-60' 
                                        : 'bg-indigo-50/20 border-indigo-100/50 hover:border-indigo-100'
                                    }`}
                                  >
                                    <button 
                                      onClick={() => toggleSubtaskCompletion(task.id, sub.id)}
                                      className="text-indigo-600 mt-0.5 shrink-0"
                                    >
                                      {sub.completed ? (
                                        <CheckCircle className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                                      ) : (
                                        <Square className="w-4 h-4 text-slate-300" />
                                      )}
                                    </button>
                                    <div>
                                      <span className={`font-semibold text-xs block text-slate-800 ${sub.completed ? 'line-through text-slate-400' : ''}`}>
                                        {sub.title}
                                      </span>
                                      <p className="text-[10px] text-slate-500 mt-0.5">{sub.description}</p>
                                      <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50/80 text-indigo-600 rounded font-bold font-mono mt-1.5 inline-block">
                                        Phase {sub.phase} • {sub.duration}h
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: CALENDAR VIEW */}
            {activeTab === 'calendar' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">System Calendar Interface</h2>
                    <p className="text-xs text-slate-500">Configure core working blocks and let the scheduler align focus blocks dynamically</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-slate-500 uppercase">Work Day Starts</span>
                    <input 
                      type="text" 
                      value={workStart} 
                      onChange={(e) => {
                        setWorkStart(e.target.value);
                        localStorage.setItem('helpinghand_workstart', e.target.value);
                      }}
                      placeholder="09:00"
                      className="p-2 bg-white border border-slate-200 rounded-xl font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-slate-500 uppercase">Work Day Ends</span>
                    <input 
                      type="text" 
                      value={workEnd} 
                      onChange={(e) => {
                        setWorkEnd(e.target.value);
                        localStorage.setItem('helpinghand_workend', e.target.value);
                      }}
                      placeholder="17:00"
                      className="p-2 bg-white border border-slate-200 rounded-xl font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1.5 justify-center">
                    <button
                      onClick={handleRebuildSchedule}
                      disabled={isRebuildingSchedule}
                      className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow cursor-pointer text-center"
                    >
                      Optimize and Block Focus Time
                    </button>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-1 divide-y divide-slate-100 font-mono text-xs">
                    {/* Hourly display rows */}
                    {Array.from({ length: 11 }, (_, i) => i + 8).map((hour) => {
                      const hourStr = `${String(hour).padStart(2, '0')}:00`;
                      const activeEvents = calendarEvents.filter(e => {
                        const sHour = parseInt(e.start.split(':')[0]);
                        return sHour === hour;
                      });

                      return (
                        <div key={hour} className="flex min-h-[70px] bg-slate-50/30 hover:bg-slate-50/50">
                          <div className="w-16 p-3 text-slate-400 font-semibold border-r border-slate-100 text-right shrink-0 select-none">
                            {hourStr}
                          </div>
                          <div className="flex-1 p-2 flex flex-col gap-1.5 justify-center">
                            {activeEvents.map(e => (
                              <div 
                                key={e.id}
                                className={`px-4 py-2 rounded-xl border text-left font-sans ${
                                  e.type === 'meeting' 
                                    ? 'bg-amber-100/70 border-amber-200 text-amber-900' 
                                    : e.type === 'focus' 
                                      ? 'bg-indigo-100/70 border-indigo-200 text-indigo-900' 
                                      : 'bg-emerald-100/70 border-emerald-200 text-emerald-900'
                                }`}
                              >
                                <span className="font-bold text-xs block">{e.title}</span>
                                <span className="text-[10px] text-slate-500 font-mono font-medium">{e.start} - {e.end}</span>
                              </div>
                            ))}
                            {activeEvents.length === 0 && (
                              <span className="text-[10px] text-slate-300 font-sans pl-2 select-none">Unscheduled Slot Horizon</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: ANALYTICS VIEW */}
            {activeTab === 'analytics' && (
              <div className="flex flex-col gap-6">
                
                {/* Metrics top raw widgets */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-5 bg-white border border-slate-200 rounded-3xl text-center shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Global Velocity</span>
                    <span className="text-2xl font-black text-slate-900 font-mono">{completionRate}%</span>
                    <span className="text-[10px] font-semibold text-indigo-600 block mt-1">Milestone Completion</span>
                  </div>

                  <div className="p-5 bg-white border border-slate-200 rounded-3xl text-center shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Hours Logged</span>
                    <span className="text-2xl font-black text-indigo-600 font-mono">{totalCompletedHours}h</span>
                    <span className="text-[10px] font-semibold text-indigo-600 block mt-1">Deep Focus Cycles</span>
                  </div>

                  <div className="p-5 bg-white border border-slate-200 rounded-3xl text-center shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Est. Drift Ratio</span>
                    <span className="text-2xl font-black text-slate-900 font-mono">{(procrastinationBuffer * 100 - 100).toFixed(0)}%</span>
                    <span className="text-[10px] font-semibold text-amber-600 block mt-1">Lag-adjustment safety</span>
                  </div>

                  <div className="p-5 bg-white border border-slate-200 rounded-3xl text-center shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Mindfulness Streak</span>
                    <span className="text-2xl font-black text-emerald-600 font-mono">{habitsStreak} Days</span>
                    <span className="text-[10px] font-semibold text-emerald-600 block mt-1">Consistent Alignment</span>
                  </div>
                </div>

                {/* Custom SVG Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Chart 1: Focus Hours Over the Week */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                    <h4 className="font-bold text-slate-900 text-sm mb-4 tracking-tight flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-indigo-500" /> Focus Allocation Patterns (Weekly)
                    </h4>
                    
                    {/* SVG representation of Bar Chart */}
                    <div className="h-44 flex items-end justify-between gap-2.5 pt-6 border-b border-l border-slate-100 pl-4 pb-2">
                      {focusLogs.map((log) => {
                        const heightPercent = (log.hours / 6) * 100;
                        return (
                          <div key={log.id} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                            <span className="text-[10px] font-bold font-mono text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              {log.hours}h
                            </span>
                            <div 
                              style={{ height: `${heightPercent}%` }}
                              className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t-lg transition-all"
                            />
                            <span className="text-[10px] font-semibold text-slate-400">{log.date}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chart 2: Task breakdown by Category */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                    <h4 className="font-bold text-slate-900 text-sm mb-4 tracking-tight flex items-center gap-1.5">
                      <PieChart className="w-4 h-4 text-indigo-500" /> Category Landmark Distributions
                    </h4>

                    <div className="flex items-center justify-around gap-4 h-44">
                      {/* Interactive SVG Circular Donut Chart */}
                      <svg className="w-32 h-32 transform -rotate-90 shrink-0">
                        <circle 
                          cx="64" cy="64" r="50" 
                          fill="transparent" 
                          stroke="#f1f5f9" 
                          strokeWidth="14" 
                        />
                        <circle 
                          cx="64" cy="64" r="50" 
                          fill="transparent" 
                          stroke="#6366f1" 
                          strokeWidth="14" 
                          strokeDasharray={314}
                          strokeDashoffset={314 - (314 * completionRate) / 100}
                          className="transition-all duration-500"
                        />
                      </svg>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 bg-indigo-500 rounded-full" />
                          <span className="text-slate-600 font-semibold">Completed Tasks: {completedCount}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 bg-slate-200 rounded-full" />
                          <span className="text-slate-600 font-semibold">Pending Tasks: {pendingCount}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100">
                          Total work remaining: <strong className="text-slate-600">{estimatedHoursLeft} hours</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Calibration panel: lag adjustments */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h4 className="font-bold text-base tracking-tight mb-1">Time Estimation Calibration</h4>
                    <p className="text-xs text-slate-300 max-w-lg font-medium">
                      If you consistently find tasks taking longer than estimated, log procrastination cycles to let the AI calibrate the safety buffers on all active schedules.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={handleLogProcrastination}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      Log Procrastination ({procrastinationBuffer}x Buffer)
                    </button>
                    {procrastinationBuffer > 1.0 && (
                      <button 
                        onClick={handleResetBuffer}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-slate-700 cursor-pointer"
                      >
                        Reset Buffer
                      </button>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* --- RIGHT SIDEBAR: AI STRATEGIST COACH & VOICE COMPANION (Cols: 4) --- */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* VOICE COMPANION INTERACTIVE DIAL */}
            <div className="bg-gradient-to-tr from-indigo-50 to-indigo-100/50 border border-indigo-200 rounded-3xl p-5 shadow-sm text-center">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 block mb-2">Speech Interface Portal</span>
              
              <div className="flex justify-center items-center gap-4 mb-3">
                <button
                  onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                  className={`p-5 rounded-full shadow-lg transition-all cursor-pointer relative ${
                    isListening 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white ring-4 ring-rose-200' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105 shadow-indigo-300'
                  }`}
                  title={isListening ? "Stop listening voice commands" : "Start speaking to your AI Companion"}
                >
                  {isListening ? (
                    <MicOff className="w-6 h-6 animate-pulse" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                  {isListening && (
                    <div className="absolute -inset-1 rounded-full border border-rose-400 animate-pulse-ring pointer-events-none" />
                  )}
                </button>
              </div>

              <h4 className="font-bold text-slate-800 text-sm tracking-tight mb-1">
                {isListening ? 'Helping Hand Listening...' : 'Speak with your Companion'}
              </h4>
              <p className="text-[11px] text-indigo-900/70 max-w-[240px] mx-auto font-medium">
                Try: <strong>&quot;What is next?&quot;</strong> or <strong>&quot;Start focus session&quot;</strong> to trigger local protocol commands.
              </p>
            </div>

            {/* AI STRATEGIST CHAT CONTAINER */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col h-[520px] overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-sm text-slate-800 tracking-tight">AI Coach Strategist</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Gemini-3.5-Flash</span>
              </div>

              {/* Chat Message Box */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m) => (
                  <div 
                    key={m.id} 
                    className={`flex flex-col max-w-[85%] ${
                      m.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed font-medium ${
                      m.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50'
                    }`}>
                      {/* Handle markdown bold formatting nicely */}
                      <p className="whitespace-pre-line">
                        {m.content}
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-400 font-semibold font-mono mt-1">{m.timestamp}</span>
                  </div>
                ))}

                {isCoachTyping && (
                  <div className="mr-auto items-start max-w-[85%] flex flex-col">
                    <div className="bg-slate-100 border border-slate-200/50 p-3 rounded-2xl rounded-tl-none">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {apiError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-[11px] text-rose-800 font-semibold">
                    Error: {apiError}
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Proactive Recommendation Prompt chips */}
              <div className="p-2 border-t border-slate-100 bg-slate-50/30 flex gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
                <button 
                  onClick={() => handleQuickPrompt("Audit my deadline risks and suggest which task needs immediate compression.")}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-full text-[10px] font-bold text-slate-600 shrink-0 transition-all cursor-pointer"
                >
                  🔍 Risk Audit
                </button>
                <button 
                  onClick={() => handleQuickPrompt("I am feeling overwhelmed by my study task list, write a quick cognitive sequence to get started.")}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-full text-[10px] font-bold text-slate-600 shrink-0 transition-all cursor-pointer"
                >
                  🧘 Procrastination Help
                </button>
                <button 
                  onClick={() => handleQuickPrompt("Provide a quick professional status update template I can send to my supervisor regarding current work.")}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-full text-[10px] font-bold text-slate-600 shrink-0 transition-all cursor-pointer"
                >
                  📊 Status Draft
                </button>
              </div>

              {/* Chat Input Area */}
              <div className="p-3 border-t border-slate-200 flex gap-2 bg-slate-50/50 shrink-0">
                <input 
                  type="text" 
                  placeholder="Ask your Coach Strategist..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => handleSendChat()}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

        </div>

      </section>

    </main>

      {/* --- GMAIL HELPER: EMAIL DRAFT MODAL --- */}
      {isEmailModalOpen && emailTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-500" /> AI Gmail Communication Assistant
                </h3>
                <p className="text-xs text-slate-500">Generate professional outreach emails linked to task milestones</p>
              </div>
              <button 
                onClick={() => setIsEmailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase">Linked Task Landmark</span>
                  <div className="p-2.5 bg-slate-100 rounded-xl font-bold text-xs text-slate-700">{emailTask.title}</div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase">Email Type Target</span>
                  <select 
                    value={emailType}
                    onChange={(e: any) => setEmailType(e.target.value)}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="extension">Request Deadline Extension</option>
                    <option value="report">Concise Progress Report</option>
                    <option value="followup">Collaborator Milestone Follow-up</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase">Recipient (e.g. Supervisor)</span>
                  <input 
                    type="text" 
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="e.g., Prof. Mitchell"
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase">Custom Context details</span>
                  <input 
                    type="text" 
                    value={emailContext}
                    onChange={(e) => setEmailContext(e.target.value)}
                    placeholder="e.g., Need 2 more days for revision review"
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateEmail}
                disabled={isGeneratingEmail}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                {isGeneratingEmail ? 'Drafting communication copy...' : 'Generate AI Email Draft'}
              </button>

              {emailDraft && (
                <div className="flex flex-col gap-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase">Generated Copy</span>
                    <button
                      onClick={handleCopyEmail}
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] leading-relaxed font-sans text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-52 select-text">
                    {emailDraft}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex justify-end">
              <button 
                onClick={() => setIsEmailModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
              >
                Close Gateway
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Footer Details matching Sleek Interface theme */}
      <footer className="h-12 border-t border-slate-200 bg-white px-6 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SYSTEM ACTIVE
          </span>
          <span>LLM: GEMINI 3.5 FLASH</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full text-[10px]">
            <Mic className="w-3 h-3 text-slate-500" />
            {isListening ? 'LISTENING (SPEAK NOW)' : 'HOLD SPACE TO SPEAK'}
          </span>
        </div>
      </footer>

    </div>
  );
}
