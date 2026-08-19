// components/auth/register-screen.tsx
"use client";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from 'next/dynamic';
import { Loader2 } from "lucide-react";
import logo from "./../../../app/assets/logo/white-logo.png"
import { toast } from "sonner";
import {
  Mail, Lock, User, Building2, MapPin,
  ChevronRight, ChevronLeft, CheckCircle2, Sun, Eye, EyeOff,
} from "lucide-react";

const PhoneInput = dynamic(
  () => import('react-phone-input-2').then(mod => mod.default),
  { ssr: false }
) as any;

import 'react-phone-input-2/lib/style.css';

const sriLankanCities = [
  "Colombo", "Kandy", "Galle", "Jaffna", "Negombo", "Nuwara Eliya",
  "Batticaloa", "Trincomalee", "Anuradhapura", "Polonnaruwa",
  "Ratnapura", "Badulla", "Kurunegala", "Matara", "Kalutara",
  "Gampaha", "Mawanella", "Kegalle", "Matale", "Ampara",
];

function Field({ icon: Icon, children, alignTop = false }: { icon: React.ElementType; children: React.ReactNode; alignTop?: boolean }) {
  return (
    <div style={{ position: "relative" }}>
      <Icon style={{
        position: "absolute",
        left: "14px",
        top: alignTop ? "14px" : "50%",
        transform: alignTop ? "none" : "translateY(-50%)",
        width: "16px",
        height: "16px",
        color: "#bbb",
        pointerEvents: "none",
        zIndex: 1,
      }} />
      {children}
    </div>
  );
}

const inputBase: React.CSSProperties = {
  width: "100%",
  height: "48px",
  paddingLeft: "42px",
  paddingRight: "16px",
  border: "1.5px solid #e4e4e4",
  borderRadius: "10px",
  background: "#fff",
  fontSize: "14px",
  color: "#111",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
  fontFamily: "inherit",
};

const label14: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "#444",
  marginBottom: "7px",
};

export function RegisterScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isGoogleSignup, setIsGoogleSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const [vendorData, setVendorData] = useState({
    organizationName: "",
    branch: "",
    address: "",
  });
  const [personalData, setPersonalData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  // Check for Google / incomplete-profile signup params
  useEffect(() => {
    const googleSignup = searchParams.get("google_signup") === "true";
    const completeVendor = searchParams.get("complete_vendor") === "true";
    const email = searchParams.get("email");
    const firstName = searchParams.get("firstName");
    const lastName = searchParams.get("lastName");

    if (googleSignup && email) {
      setIsGoogleSignup(true);
      setPersonalData((prev) => ({
        ...prev,
        email,
        firstName: firstName || "",
        lastName: lastName || "",
      }));

      // Vendor details are always collected on step 1 first
      setStep(1);

      toast.info(
        completeVendor
          ? "Please add your organization details to finish setup"
          : "Please complete your profile",
        { duration: 3000, position: "top-center" }
      );
    }
  }, [searchParams]);

  const handleVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (vendorData.organizationName && vendorData.branch && vendorData.address) {
      setStep(2);
    }
  };

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    if (!isGoogleSignup) {
      if (personalData.password !== personalData.confirmPassword) {
        toast.error("Passwords do not match");
        setIsLoading(false);
        return;
      }

      if (personalData.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        setIsLoading(false);
        return;
      }
    }

    try {
      console.log("Submitting registration...");
      
      let userId: string;
      
      if (isGoogleSignup) {
        // For Google signup, get existing user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user found");
        userId = user.id;
      } else {
        // Regular signup
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: personalData.email,
          password: personalData.password,
          options: {
            data: {
              first_name: personalData.firstName,
              last_name: personalData.lastName,
              phone: personalData.phone,
            },
          },
        });
        
        if (authError) throw new Error(authError.message);
        if (!authData.user) throw new Error("Failed to create user");
        userId = authData.user.id;
      }
      
      // Update users table
      const { error: userError } = await supabase
        .from('users')
        .update({
          first_name: personalData.firstName,
          last_name: personalData.lastName,
          phone: personalData.phone || null,
          is_vendor: true,
          is_customer: false,
        })
        .eq('id', userId);
      
      if (userError) throw new Error(userError.message);
      
      // Insert into vendors table
      const { error: vendorError } = await supabase
        .from('vendors')
        .insert({
          user_id: userId,
          vendor_name: vendorData.organizationName,
          branch: vendorData.branch,
          address: vendorData.address,
          image1: null,
        });
      
      if (vendorError) throw new Error(vendorError.message);
      
      console.log("Registration successful!");
      toast.success("Account created successfully!");
      
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
      
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Registration failed");
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    if (!vendorData.organizationName || !vendorData.branch || !vendorData.address) {
      toast.error("Please complete vendor details first");
      return;
    }

    sessionStorage.setItem('tempVendorData', JSON.stringify(vendorData));
    
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?from=register`,
      },
    });
  };

  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = "#111");
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = "#e4e4e4");

  const completeVendorOnly =
    searchParams.get("complete_vendor") === "true" && isGoogleSignup;

  return (
    <>
      <style>{`
        .custom-phone-input .flag-dropdown {
          background: #fff !important;
          border: none !important;
          border-right: 1px solid #e4e4e4 !important;
          border-radius: 10px 0 0 10px !important;
          padding: 0 6px !important;
        }
        .custom-phone-input .selected-flag {
          border-radius: 10px 0 0 10px !important;
          padding: 0 8px !important;
          width: 60px !important;
        }
        .custom-phone-input .form-control {
          width: 100% !important;
          height: 48px !important;
          padding-left: 70px !important;
          border: 1.5px solid #e4e4e4 !important;
          border-radius: 10px !important;
          font-size: 14px !important;
          font-family: inherit !important;
          background: #fff !important;
          outline: none !important;
        }
        .custom-phone-input .form-control:focus {
          border-color: #111 !important;
        }
        .custom-phone-input .country-list {
          border-radius: 10px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
          border: 1px solid #e4e4e4 !important;
          width: 280px !important;
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f0f0",
        padding: "32px",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      }}>
        <div style={{
          display: "flex",
          width: "100%",
          maxWidth: "1060px",
          minHeight: "620px",
          borderRadius: "22px",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.14)",
        }}>
          {/* LEFT PANEL */}
          <div style={{
            flex: "0 0 38%",
            background: "#111111",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "56px 44px",
          }}>
            <div style={{
              position: "absolute",
              top: "-60px",
              left: "-40px",
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #555, #222)",
              boxShadow: "inset -8px -8px 20px rgba(0,0,0,0.6), inset 6px 6px 14px rgba(255,255,255,0.06)",
              opacity: 0.9,
            }} />
            <div style={{
              position: "absolute",
              bottom: "-80px",
              left: "-60px",
              width: "280px",
              height: "280px",
              borderRadius: "50%",
              background: "radial-gradient(circle at 40% 40%, #444, #1a1a1a)",
              boxShadow: "inset -10px -10px 24px rgba(0,0,0,0.7), inset 8px 8px 16px rgba(255,255,255,0.04)",
              opacity: 0.85,
            }} />
            <div style={{
              position: "absolute",
              top: "48%",
              right: "-50px",
              width: "160px",
              height: "160px",
              borderRadius: "50%",
              background: "radial-gradient(circle at 38% 38%, #3a3a3a, #151515)",
              boxShadow: "inset -6px -6px 16px rgba(0,0,0,0.6), inset 5px 5px 12px rgba(255,255,255,0.05)",
              opacity: 0.75,
            }} />

            <div style={{ position: "relative", zIndex: 2 }}>
              <img src={logo.src} alt="Logo" style={{
                width: "160px",
                height: "auto",
                objectFit: "contain",
                filter: "brightness(0) invert(1)",
              }} />
              <p style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#888",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "20px",
              }}>
                Your Multi Service Agent Pltform
              </p>
              <p style={{
                fontSize: "12.5px",
                color: "#666",
                lineHeight: 1.7,
                maxWidth: "220px",
              }}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.
              </p>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{
            flex: 1,
            background: "#fafafa",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px 56px",
            overflowY: "auto",
          }}>
            <div style={{ marginBottom: "24px" }}>
              <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#111", marginBottom: "6px" }}>
                {completeVendorOnly
                  ? "Add your organization"
                  : isGoogleSignup
                    ? "Complete your profile"
                    : "Create an account"}
              </h1>
              <p style={{ fontSize: "13px", color: "#999", marginBottom: "20px" }}>
                {step === 1 ? "Tell us about your organization" : "Complete your personal profile"}
              </p>

              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "50%",
                    background: step >= 1 ? "#111" : "transparent",
                    border: `2px solid ${step >= 1 ? "#111" : "#d0d0d0"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {step > 1 ? <CheckCircle2 style={{ width: "15px", height: "15px", color: "#fff" }} />
                      : <span style={{ fontSize: "12px", fontWeight: 700, color: step >= 1 ? "#fff" : "#bbb" }}>1</span>}
                  </div>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: step >= 1 ? "#111" : "#bbb" }}>
                    Vendor Info
                  </span>
                </div>

                <div style={{ flex: 1, height: "2px", margin: "0 12px", background: step > 1 ? "#111" : "#e0e0e0" }} />

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "50%",
                    background: step >= 2 ? "#111" : "transparent",
                    border: `2px solid ${step >= 2 ? "#111" : "#d0d0d0"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: step >= 2 ? "#fff" : "#bbb" }}>2</span>
                  </div>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: step >= 2 ? "#111" : "#bbb" }}>
                    Personal Info
                  </span>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div style={{ marginBottom: "16px", padding: "12px", background: "#fee2e2", borderRadius: "8px", color: "#dc2626", fontSize: "13px", textAlign: "center" }}>
                {errorMessage}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleVendorSubmit}>
                <div>
                  <label style={label14}>Organization name</label>
                  <Field icon={Building2}>
                    <input style={inputBase} placeholder="Enter your organization name"
                      value={vendorData.organizationName}
                      onChange={(e) => setVendorData({ ...vendorData, organizationName: e.target.value })}
                      onFocus={focus} onBlur={blur} required />
                  </Field>
                </div>

                <div style={{ marginTop: "18px" }}>
                  <label style={label14}>Branch location</label>
                  <Field icon={MapPin}>
                    <select style={{ ...inputBase, appearance: "none", cursor: "pointer" }}
                      value={vendorData.branch}
                      onChange={(e) => setVendorData({ ...vendorData, branch: e.target.value })}
                      onFocus={focus} onBlur={blur} required>
                      <option value="">Select a city in Sri Lanka</option>
                      {sriLankanCities.map((city) => (<option key={city} value={city}>{city}</option>))}
                    </select>
                  </Field>
                </div>

                <div style={{ marginTop: "18px" }}>
                  <label style={label14}>Address</label>
                  <Field icon={MapPin} alignTop>
                    <textarea rows={3} placeholder="Enter your full address"
                      style={{ ...inputBase, height: "auto", paddingTop: "12px", resize: "none" }}
                      value={vendorData.address}
                      onChange={(e) => setVendorData({ ...vendorData, address: e.target.value })}
                      onFocus={focus} onBlur={blur} required />
                  </Field>
                </div>

                <button type="submit" style={{ width: "100%", height: "50px", background: "#111", color: "#fff", borderRadius: "10px", fontSize: "15px", fontWeight: 600, marginTop: "24px" }}>
                  Continue   
                </button>

                <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#888" }}>
                  Already have an account? <Link href="/auth/login" style={{ color: "#111", fontWeight: 600 }}>Sign in</Link>
                </p>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handlePersonalSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={label14}>First name</label>
                    <Field icon={User}>
                      <input style={inputBase} placeholder="John"
                        value={personalData.firstName}
                        onChange={(e) => setPersonalData({ ...personalData, firstName: e.target.value })}
                        onFocus={focus} onBlur={blur} required />
                    </Field>
                  </div>
                  <div>
                    <label style={label14}>Last name</label>
                    <Field icon={User}>
                      <input style={inputBase} placeholder="Doe"
                        value={personalData.lastName}
                        onChange={(e) => setPersonalData({ ...personalData, lastName: e.target.value })}
                        onFocus={focus} onBlur={blur} required />
                    </Field>
                  </div>
                </div>

                <div style={{ marginTop: "16px" }}>
                  <label style={label14}>Email address</label>
                  <Field icon={Mail}>
                    <input 
                      type="email" 
                      style={inputBase} 
                      placeholder="john@example.com"
                      value={personalData.email}
                      onChange={(e) => setPersonalData({ ...personalData, email: e.target.value })}
                      onFocus={focus} 
                      onBlur={blur} 
                      required 
                      readOnly={isGoogleSignup}
                    />
                  </Field>
                </div>

                <div style={{ marginTop: "16px" }}>
                  <label style={label14}>Phone number</label>
                  <PhoneInput country="lk" preferredCountries={["lk"]}
                    value={personalData.phone}
                    onChange={(phone: string) => setPersonalData({ ...personalData, phone })}
                    containerClass="custom-phone-input"
                    inputProps={{ required: true }}
                    enableSearch={true} />
                </div>

                {!isGoogleSignup && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
                    <div>
                      <label style={label14}>Password</label>
                      <div style={{ position: "relative" }}>
                        <Lock style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#bbb" }} />
                        <input type={showPw ? "text" : "password"} style={{ ...inputBase, paddingRight: "42px" }} placeholder="Create a password"
                          value={personalData.password}
                          onChange={(e) => setPersonalData({ ...personalData, password: e.target.value })}
                          onFocus={focus} onBlur={blur} required />
                        <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}>
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={label14}>Confirm password</label>
                      <div style={{ position: "relative" }}>
                        <Lock style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#bbb" }} />
                        <input type={showConfirmPw ? "text" : "password"} style={{ ...inputBase, paddingRight: "42px" }} placeholder="Confirm password"
                          value={personalData.confirmPassword}
                          onChange={(e) => setPersonalData({ ...personalData, confirmPassword: e.target.value })}
                          onFocus={focus} onBlur={blur} required />
                        <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}>
                          {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                  <button type="button" onClick={() => setStep(1)} style={{ flex: 1, height: "50px", background: "transparent", border: "1.5px solid #d6d6d6", borderRadius: "10px", cursor: "pointer" }}>
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading} 
                    style={{ 
                      flex: 1, 
                      height: "50px", 
                      background: isLoading ? "#555" : "#111", 
                      color: "#fff", 
                      borderRadius: "10px", 
                      fontWeight: 600, 
                      cursor: isLoading ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      isGoogleSignup ? "Complete Registration" : "Create account"
                    )}
                  </button>
                </div>

                {!isGoogleSignup && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "20px 0" }}>
                      <div style={{ flex: 1, height: "1px", background: "#e4e4e4" }} />
                      <span style={{ fontSize: "11px", color: "#bbb" }}>or</span>
                      <div style={{ flex: 1, height: "1px", background: "#e4e4e4" }} />
                    </div>

                    <button type="button" onClick={handleGoogleSignUp} style={{ width: "100%", height: "50px", background: "transparent", border: "1.5px solid #d6d6d6", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer" }}>
                      <Sun size={17} /> Sign up with Google
                    </button>
                  </>
                )}

                <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#888" }}>
                  Already have an account? <Link href="/auth/login" style={{ color: "#111", fontWeight: 600 }}>Sign in</Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}