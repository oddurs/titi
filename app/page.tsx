import Device from "@/components/Device";
import DeviceBoundary from "@/components/DeviceBoundary";

export default function Page() {
  return (
    <DeviceBoundary>
      <Device />
    </DeviceBoundary>
  );
}
