import ShopeePartnerDashboard from "./ShopeePartnerDashboard";
import LoginGate from "./LoginGate";

export default function App() {
  return (
    <LoginGate>
      <ShopeePartnerDashboard />
    </LoginGate>
  );
}
