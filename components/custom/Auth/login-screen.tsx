// components/auth/login-screen.tsx - Simplified handleSubmit and handleGoogleSignIn
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Sun } from "lucide-react";
import logo from "./../../../app/assets/logo/white-logo.png"

import { createClient } from "@/lib/supabase/client";

export function LoginScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
    }
    // Let the callback and auth guard handle redirection
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError("");
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?from=login`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    
    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  // Rest of your UI remains exactly the same
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a1a",
        padding: "24px",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          maxWidth: "860px",
          minHeight: "520px",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* LEFT PANEL - Keep your existing design */}
        <div
          style={{
            flex: "0 0 42%",
            background: "#111111",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px 40px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-60px",
              left: "-40px",
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #555, #222)",
              boxShadow: "inset -8px -8px 20px rgba(0,0,0,0.6), inset 6px 6px 14px rgba(255,255,255,0.06)",
              opacity: 0.9,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-80px",
              left: "-60px",
              width: "280px",
              height: "280px",
              borderRadius: "50%",
              background: "radial-gradient(circle at 40% 40%, #444, #1a1a1a)",
              boxShadow: "inset -10px -10px 24px rgba(0,0,0,0.7), inset 8px 8px 16px rgba(255,255,255,0.04)",
              opacity: 0.85,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "48%",
              right: "-50px",
              width: "160px",
              height: "160px",
              borderRadius: "50%",
              background: "radial-gradient(circle at 38% 38%, #3a3a3a, #151515)",
              boxShadow: "inset -6px -6px 16px rgba(0,0,0,0.6), inset 5px 5px 12px rgba(255,255,255,0.05)",
              opacity: 0.75,
            }}
          />

          <div style={{ position: "relative", zIndex: 2 }}>
             <img src={logo.src} alt="Logo" style={{
                            width: "160px",
                            height: "auto",
                            objectFit: "contain",
                            filter: "brightness(0) invert(1)",
                          }} />
             
            <p
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#888",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "20px",
              }}
            >
              Your Multi Service Agent Pltform
            </p>
            <p
              style={{
                fontSize: "12.5px",
                color: "#666",
                lineHeight: 1.7,
                maxWidth: "220px",
              }}
            >
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.
            </p>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div
          style={{
            flex: 1,
            background: "#f8f8f8",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px 44px",
          }}
        >
          <div style={{ marginBottom: "28px" }}>
            <h1
              style={{
                fontSize: "26px",
                fontWeight: 700,
                color: "#111",
                marginBottom: "6px",
                letterSpacing: "-0.02em",
              }}
            >
              Sign in
            </h1>
            <p style={{ fontSize: "12.5px", color: "#999" }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit
            </p>
          </div>

          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px",
                borderRadius: "8px",
                background: "#fee",
                color: "#c00",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ position: "relative" }}>
              <Mail
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "16px",
                  height: "16px",
                  color: "#aaa",
                  pointerEvents: "none",
                }}
              />
              <input
                type="email"
                placeholder="Email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{
                  width: "100%",
                  height: "44px",
                  paddingLeft: "38px",
                  paddingRight: "14px",
                  border: "1.5px solid #e2e2e2",
                  borderRadius: "8px",
                  background: "#fff",
                  fontSize: "13.5px",
                  color: "#111",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#111")}
                onBlur={(e) => (e.target.style.borderColor = "#e2e2e2")}
              />
            </div>

            <div style={{ position: "relative" }}>
              <Lock
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "16px",
                  height: "16px",
                  color: "#aaa",
                  pointerEvents: "none",
                }}
              />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{
                  width: "100%",
                  height: "44px",
                  paddingLeft: "38px",
                  paddingRight: "56px",
                  border: "1.5px solid #e2e2e2",
                  borderRadius: "8px",
                  background: "#fff",
                  fontSize: "13.5px",
                  color: "#111",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#111")}
                onBlur={(e) => (e.target.style.borderColor = "#e2e2e2")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#555",
                  letterSpacing: "0.04em",
                  padding: 0,
                }}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontSize: "12.5px",
                  color: "#555",
                }}
              >
                <input
                  type="checkbox"
                  style={{
                    width: "15px",
                    height: "15px",
                    accentColor: "#111",
                    cursor: "pointer",
                  }}
                />
                Remember me
              </label>
              <a
                href="#"
                style={{
                  fontSize: "12.5px",
                  color: "#555",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                height: "44px",
                background: isLoading ? "#555" : "#111",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                letterSpacing: "0.02em",
                transition: "background 0.2s, transform 0.1s",
              }}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              margin: "18px 0",
            }}
          >
            <div style={{ flex: 1, height: "1px", background: "#e2e2e2" }} />
            <span style={{ fontSize: "11px", color: "#bbb", letterSpacing: "0.04em" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "#e2e2e2" }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            style={{
              width: "100%",
              height: "44px",
              background: "transparent",
              color: "#333",
              border: "1.5px solid #d0d0d0",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 500,
              cursor: isLoading ? "not-allowed" : "pointer",
              letterSpacing: "0.01em",
              transition: "border-color 0.2s, background 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Sun size={16} />
            Sign in with Google
          </button>

          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "12.5px", color: "#888" }}>
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              style={{ color: "#111", fontWeight: 600, textDecoration: "none" }}
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}