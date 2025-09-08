import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-8">
        <div className="text-center">
          <Image 
            src="/SAM.jpg" 
            alt="SAM AI" 
            width={100}
            height={100}
            className="rounded-full mx-auto mb-4 object-cover"
            style={{ objectPosition: 'center 30%' }}
          />
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to SAM AI</h1>
          <p className="text-gray-400">Your AI-powered Sales Assistant</p>
        </div>
        <SignIn 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-gray-800 shadow-xl",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              logoBox: "hidden",
              logoImage: "hidden",
              header: "hidden",
              socialButtonsBlockButton: "bg-gray-700 border-gray-600 text-white hover:bg-gray-600",
              formButtonPrimary: "bg-purple-600 hover:bg-purple-700 text-white",
              footerActionLink: "text-purple-400 hover:text-purple-300",
              identityPreviewText: "text-gray-300",
              identityPreviewEditButtonIcon: "text-purple-400",
              formFieldLabel: "text-gray-300",
              formFieldInput: "bg-gray-700 border-gray-600 text-white",
              dividerLine: "bg-gray-600",
              dividerText: "text-gray-400",
            },
            layout: {
              logoPlacement: "none",
              shimmer: false
            }
          }}
        />
      </div>
    </div>
  );
}