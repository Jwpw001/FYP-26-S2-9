import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { SkillLibrary } from "../../components/SkillsManager";

export default function BOSkillSettings() {
  return (
    <BusinessOwnerLayout title="Skills">
      <div style={{ maxWidth: 680, animation: "fadeUp 0.3s ease" }}>
        <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px" }}>
          Define the skills relevant to your business. Managers can assign them to staff from their profile page.
        </p>
        <SkillLibrary />
      </div>
    </BusinessOwnerLayout>
  );
}
