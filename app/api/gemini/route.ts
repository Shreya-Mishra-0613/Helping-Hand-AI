import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Initialize Gemini client with proper header for AI Studio telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in the environment. Please add it via the Secrets panel." },
        { status: 500 }
      );
    }

    if (action === "breakdown") {
      const { taskTitle, taskDescription, totalHours } = payload;
      
      const prompt = `Break down the following major task into 3 to 6 actionable sub-tasks with estimated hours and a logical execution sequence.
Major Task: "${taskTitle}"
Description: ${taskDescription || "No description provided"}
Total Target Hours: ${totalHours || 4}

Provide the output in JSON matching this schema:
[
  {
    "id": "string (unique temporary slug like research-phase)",
    "title": "string (action-oriented name)",
    "duration": "number (estimated hours, total sum should be close to target hours)",
    "description": "string (short description of what to do)",
    "phase": "number (1 for first steps, 2 for next steps, etc.)"
  }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                duration: { type: Type.NUMBER },
                description: { type: Type.STRING },
                phase: { type: Type.INTEGER }
              },
              required: ["id", "title", "duration", "description", "phase"]
            }
          }
        }
      });

      const responseText = response.text || "[]";
      return NextResponse.json({ result: JSON.parse(responseText.trim()) });

    } else if (action === "coach") {
      const { messages, currentContext } = payload;
      
      // Generate coach response
      const systemInstruction = `You are "Helping Hand AI Coach", a supportive, highly strategic productivity partner.
You help users plan their day, overcome procrastination, predict deadline risks, and focus on what truly matters.
Your advice is concise, actionable, and free of fluff or sales pitch. Use clear headings, bullet points, and highlight best next actions.
Context about the user:
- Current Active Task: ${currentContext.activeTask ? `"${currentContext.activeTask.title}" (${currentContext.activeTask.duration}h estimated)` : "None"}
- Today's Workload: ${currentContext.tasksCount} tasks, totaling ${currentContext.totalWorkload} hours of work.
- Overdue or Critical Deadlines: ${currentContext.highRiskCount} tasks at high risk of missing deadlines.
- Productivity Persona: ${currentContext.persona || "Balanced Achiever"}`;

      // Convert messages to Gemini SDK contents format
      const contents = messages.map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      return NextResponse.json({ text: response.text });

    } else if (action === "email") {
      const { emailType, taskTitle, recipient, contextInfo } = payload;
      
      let prompt = "";
      if (emailType === "extension") {
        prompt = `Draft a polite, professional email requesting a brief deadline extension for the task "${taskTitle}".
Recipient: ${recipient || "Manager / Professor"}
Additional Context: ${contextInfo || "Needs extra time to refine quality"}
Keep it professional, direct, and collaborative. Suggest a realistic alternative deadline.`;
      } else if (emailType === "report") {
        prompt = `Draft a concise status report email detailing progress on "${taskTitle}".
Recipient: ${recipient || "Team / Stakeholder"}
Additional Details: ${contextInfo || "Initial milestones met, final review in progress"}
Include current progress, next steps, and any risks.`;
      } else {
        prompt = `Draft a quick, professional follow-up email regarding "${taskTitle}".
Recipient: ${recipient || "Collaborator"}
Additional Details: ${contextInfo || "Checking in on the shared deliverables"}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are a professional business communication writer. Keep emails concise, structured, and extremely professional.",
          temperature: 0.6,
        }
      });

      return NextResponse.json({ text: response.text });

    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Gemini API Route Error:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred during Gemini API generation" },
      { status: 500 }
    );
  }
}
