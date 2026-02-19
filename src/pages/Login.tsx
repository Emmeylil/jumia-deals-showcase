import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        // Configuration Check
        if (!import.meta.env.VITE_FIREBASE_API_KEY) {
            toast.error("Firebase Configuration Error: API Key missing. Did you restart the dev server after editing .env?");
            console.error("VITE_FIREBASE_API_KEY is undefined. Check your .env file.");
            return;
        }

        setLoading(true);

        // Debug: Check if env is loaded
        console.log("Attempting login for Firebase Project:", import.meta.env.VITE_FIREBASE_PROJECT_ID);

        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
            toast.success("Welcome back, Admin!");
            navigate("/admin");
        } catch (error: any) {
            console.error("Login error code:", error.code);
            console.error("Login error message:", error.message);

            if (error.code === 'auth/invalid-credential') {
                toast.error("Invalid email or password. Please check your credentials.");
            } else if (error.code === 'auth/user-not-found') {
                toast.error("No account found with this email. Did you create it in Firebase Console?");
            } else if (error.code === 'auth/wrong-password') {
                toast.error("Incorrect password.");
            } else if (error.code === 'auth/too-many-requests') {
                toast.error("Too many failed attempts. Account temporarily locked.");
            } else if (error.code === 'auth/network-request-failed') {
                toast.error("Network error. Please check your internet connection.");
            } else {
                toast.error(`Login failed [${error.code}]: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-[2.5rem] shadow-xl p-8 md:p-12 border border-gray-100 ring-4 ring-black/5">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                            <Lock className="text-white w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900">Admin Portal</h1>
                        <p className="text-muted-foreground text-sm font-medium mt-1 uppercase tracking-widest text-[10px]">Secure Backend Access</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 ml-1">Email Address</label>
                            <Input
                                type="email"
                                placeholder="admin@jumia.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-12 px-4 rounded-xl border-gray-200 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 ml-1">Password</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-12 px-4 rounded-xl border-gray-200 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/95 text-white font-black text-sm transition-all shadow-lg shadow-primary/20 active:scale-[0.98] mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    AUTHENTICATING...
                                </>
                            ) : (
                                "SIGN IN TO CATALOG"
                            )}
                        </Button>
                    </form>

                    <p className="text-center text-[10px] text-muted-foreground mt-8 font-bold uppercase tracking-widest leading-relaxed">
                        RESTRICTED ACCESS AREA<br />
                        UNAUTHORIZED ENTRY IS LOGGED
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
