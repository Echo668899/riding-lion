import { Route, Routes } from "react-router-dom";
import { SiteChrome } from "./components/SiteChrome";
import { AccountPage } from "./pages/Account";
import { CheckoutPage } from "./pages/Checkout";
import { HomePage } from "./pages/Home";
import { LoginPage } from "./pages/Login";
import { PrivacyPage } from "./pages/Privacy";
import { ResultPage } from "./pages/Result";

export function App() {
  return (
    <SiteChrome>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/r/:accessToken" element={<ResultPage />} />
      </Routes>
    </SiteChrome>
  );
}
