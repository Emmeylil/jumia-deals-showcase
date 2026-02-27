import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            const isConfigError = this.state.error?.message?.includes("VITE_");

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                    <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-red-100 animate-in fade-in zoom-in duration-300">
                        <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>

                        <h1 className="text-2xl font-black text-gray-900 text-center mb-2">
                            Something went wrong
                        </h1>

                        <p className="text-gray-500 text-center text-sm mb-6 font-medium">
                            The application encountered an unexpected error and couldn't continue.
                        </p>

                        <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100 overflow-hidden">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Error Details</p>
                            <p className="text-xs font-mono text-red-600 break-words leading-relaxed">
                                {this.state.error?.name}: {this.state.error?.message}
                            </p>
                        </div>

                        {isConfigError && (
                            <div className="bg-amber-50 rounded-2xl p-4 mb-6 border border-amber-100">
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Potential Solution</p>
                                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                    It looks like some environment variables are missing. Please ensure your hosting provider has the correct VITE_* keys configured.
                                </p>
                            </div>
                        )}

                        <Button
                            onClick={this.handleReset}
                            className="w-full bg-jumia-purple hover:bg-jumia-purple/90 text-white rounded-xl py-6 font-bold shadow-lg shadow-jumia-purple/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reload Application
                        </Button>

                        <p className="mt-8 text-center text-[10px] text-gray-400 font-medium italic">
                            Try clearing your browser cache if the issue persists.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
