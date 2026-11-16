import { FirebaseEegUpload } from "@/features/eeg/firebase-eeg-upload";
export const metadata = { title: "Upload EEG", description: "Analyze your EEG recording and review research-model results." };
// Camera/file/account state is resolved in the signed-in client; this route may block.
export const instant = false;
export default function UploadPage() { return <FirebaseEegUpload />; }
