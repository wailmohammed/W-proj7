
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, FunctionDeclaration, Type } from "@google/genai";
import { usePortfolio } from '../context/PortfolioContext';
import { MessageSquare, X, Send, Loader2, Sparkles, Bot, ChevronDown, CheckCircle2, Mic, MicOff } from 'lucide-react';
import { MOCK_MARKET_ASSETS } from '../constants';

const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; isTool?: boolean }[]>([
    { role: 'model', text: 'Hello! I am WealthGPT. I can analyze your portfolio, explain financial concepts, or even add transactions for you (e.g., "Buy 10 shares of AAPL"). How can I help?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { activePortfolio, addTransaction } = usePortfolio();
  const [chatSession, setChatSession] = useState<Chat | null>(null);

  // Initialize the AI client
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Define Function Tools
  const addTransactionTool: FunctionDeclaration = {
    name: 'addTransaction',
    description: 'Add a new transaction (Buy or Sell) to the portfolio.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        symbol: { type: Type.STRING, description: 'The stock ticker symbol (e.g., AAPL, TSLA)' },
        type: { type: Type.STRING, description: 'The type of transaction', enum: ['BUY', 'SELL'] },
        shares: { type: Type.NUMBER, description: 'Number of shares' },
        price: { type: Type.NUMBER, description: 'Price per share in USD' },
      },
      required: ['symbol', 'type', 'shares', 'price']
    }
  };

  // Initialize Chat Session when opened
  useEffect(() => {
    if (isOpen && !chatSession) {
        const totalVal = activePortfolio.totalValue;
        const cash = activePortfolio.cashBalance;
        const holdingsCount = activePortfolio.holdings.length;
        const topHoldings = [...activePortfolio.holdings]
            .sort((a, b) => (b.shares * b.currentPrice) - (a.shares * a.currentPrice))
            .slice(0, 3)
            .map(h => `${h.symbol} (${((h.shares * h.currentPrice)/totalVal * 100).toFixed(1)}%)`)
            .join(', ');
        
        const totalYield = totalVal > 0 
            ? activePortfolio.holdings.reduce((acc, h) => acc + (h.shares * h.currentPrice * (h.dividendYield/100)), 0) / totalVal * 100 
            : 0;

        const portfolioContext = `
            CURRENT PORTFOLIO SNAPSHOT (${new Date().toLocaleDateString()}):
            Portfolio Name: ${activePortfolio.name}
            Total Net Asset Value: $${totalVal.toFixed(2)}
            Cash Available: $${cash.toFixed(2)}
            Number of Holdings: ${holdingsCount}
            Top 3 Concentrations: ${topHoldings}
            Weighted Dividend Yield: ${totalYield.toFixed(2)}%
            
            HOLDINGS DETAIL:
            ${activePortfolio.holdings.map(h => 
                `- ${h.symbol} (${h.name}): ${h.shares} sh @ $${h.currentPrice.toFixed(2)}. Value: $${(h.shares * h.currentPrice).toFixed(2)}. Sector: ${h.sector}. Yield: ${h.dividendYield}%.`
            ).join('\n')}
        `;

        const session = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: `You are WealthOS AI, an expert financial assistant embedded in a wealth management app.
                You are helpful, professional, and concise.
                
                Your goal is to provide personalized insights based on the user's specific portfolio data provided below.
                - If the user asks for "risk analysis", analyze their sector concentration and high-beta stocks (Tech/Crypto).
                - If the user asks for "dividend advice", look at their yield and payout safety.
                - If the user asks to "compare to S&P 500", give general market context.
                
                CRITICAL: When a user asks to buy or sell a stock, you MUST use the 'addTransaction' tool. 
                If you use the tool, confirm the action in your text response briefly.
                
                ${portfolioContext}`,
                tools: [{ functionDeclarations: [addTransactionTool] }]
            }
        });
        setChatSession(session);
    }
  }, [isOpen]); 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatSession) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
        const result = await chatSession.sendMessage({ message: userMsg });
        
        // Handle Function Calls
        const functionCalls = result.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
                if (call.name === 'addTransaction') {
                    const args = call.args as any;
                    
                    // Look up the real asset ID from constants
                    // In a real app, this would be an API search
                    const marketAsset = MOCK_MARKET_ASSETS.find(
                      a => a.symbol.toUpperCase() === args.symbol.toUpperCase()
                    );

                    let responseText = '';
                    if (marketAsset) {
                      const date = new Date().toISOString().split('T')[0];
                      // Execute Context Action
                      addTransaction(marketAsset.id, args.type, args.shares, args.price, date);
                      responseText = `✅ Executed: ${args.type} ${args.shares} ${args.symbol.toUpperCase()} @ $${args.price}`;
                    } else {
                      responseText = `⚠️ Error: Could not find asset '${args.symbol}'. Transaction not executed.`;
                    }
                    
                    // Send tool response back to model to continue conversation
                    await chatSession.sendToolResponse({
                        functionResponses: [{
                            id: call.id,
                            name: call.name,
                            response: { result: responseText }
                        }]
                    });

                    setMessages(prev => [...prev, { role: 'model', text: responseText, isTool: true }]);
                }
            }
        } 
        
        // If there is text response (either standalone or after tool use)
        if (result.text && (!functionCalls || functionCalls.length === 0)) {
             setMessages(prev => [...prev, { role: 'model', text: result.text || "" }]);
        } else if (result.text) {
             // Append text explanation if it came with tool
             setMessages(prev => [...prev, { role: 'model', text: result.text || "" }]);
        }

    } catch (error) {
        console.error("Chat Error:", error);
        setMessages(prev => [...prev, { role: 'model', text: "I encountered an error processing that request." }]);
    } finally {
        setIsLoading(false);
    }
  };

  // Voice Recognition Handler
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      // Optional: Auto-send could be triggered here if desired
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <>
        {/* Floating Toggle Button */}
        <button
            onClick={() => setIsOpen(!isOpen)}
            className={`fixed bottom-6 right-6 z-50 flex items-center justify-center transition-all duration-300 shadow-2xl shadow-brand-600/40 ${isOpen ? 'w-12 h-12 rounded-full bg-slate-800 text-slate-400 hover:text-white' : 'w-14 h-14 rounded-full bg-brand-600 text-white hover:bg-brand-500 hover:scale-105'}`}
        >
            {isOpen ? <ChevronDown className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
        </button>

        {/* Chat Window */}
        {isOpen && (
            <div className="fixed bottom-24 right-6 z-40 w-[90vw] md:w-[380px] h-[600px] max-h-[calc(100vh-140px)] bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">WealthGPT</h3>
                            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-brand-600 text-white rounded-br-none' 
                                : msg.isTool 
                                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-tl-none'
                                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                            }`}>
                                {msg.isTool && <div className="flex items-center gap-2 mb-1 font-bold text-xs uppercase"><CheckCircle2 className="w-3 h-3" /> Action Completed</div>}
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-700 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
                                <span className="text-xs text-slate-400">Processing...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-950/50 border-t border-slate-800">
                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="relative flex gap-2"
                    >
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={isListening ? "Listening..." : "Ask 'Analyze my risks'"}
                                className={`w-full bg-slate-900 border text-white text-sm rounded-xl py-3 pl-4 pr-10 focus:outline-none focus:ring-1 transition-all ${isListening ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-700 focus:border-brand-500 focus:ring-brand-500'}`}
                            />
                            <button 
                                type="button"
                                onClick={toggleListening}
                                className={`absolute right-2 top-2 p-1.5 rounded-lg transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-white'}`}
                            >
                                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                        </div>
                        <button 
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="p-3 bg-brand-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-500 transition-colors shadow-lg"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                    <div className="text-[10px] text-center text-slate-600 mt-2">
                        AI-executed trades are simulations only.
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default AIAssistant;
