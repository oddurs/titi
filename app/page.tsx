import Device from "@/components/Device";
import DeviceBoundary from "@/components/DeviceBoundary";
import DemoBar from "@/components/DemoBar";

export default function Page() {
  return (
    <DeviceBoundary>
      <DemoBar />
      <Device />
    </DeviceBoundary>
  );
}
