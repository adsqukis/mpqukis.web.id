import ShopeePartnerDashboard from "./ShopeePartnerDashboard";
import LoginGate from "./LoginGate";
import Bumper from "./Bumper";

export default function App() {
  return (
    <>
      <Bumper />
      <LoginGate>
        <ShopeePartnerDashboard />
      </LoginGate>
    </>
  );
}
