import { createContext, useContext, useState, useEffect } from "react";
import { getUser } from "../utils/auth";
import { api } from "../lib/api";

const BusinessContext = createContext({
  industry:       "f&b",
  schedulingMode: "shift",
  locationLabel:  "Outlet",
  staffLabel:     "Staff",
  plan:           "free",
  loaded:         false,
});

export function useBusinessContext() {
  return useContext(BusinessContext);
}

export function BusinessProvider({ children }) {
  const user = getUser();
  const [ctx, setCtx] = useState({
    industry:       "f&b",
    schedulingMode: "shift",
    locationLabel:  "Outlet",
    staffLabel:     "Staff",
    plan:           "free",
    loaded:         false,
  });

  useEffect(() => {
    if (!user?.user_id) return;
    fetchBusinessContext();
  }, [user?.user_id]);

  async function fetchBusinessContext() {
    try {
      const data = await api.get("/api/business/context");
      if (data?.success && data.context) {
        const biz = data.context;
        setCtx({
          industry:       biz.industry        || "f&b",
          schedulingMode: biz.scheduling_mode || "shift",
          locationLabel:  biz.location_label  || "Outlet",
          staffLabel:     biz.staff_label     || "Staff",
          plan:           biz.plan            || "free",
          loaded:         true,
        });
      } else {
        setCtx(p => ({ ...p, loaded: true }));
      }
    } catch {
      setCtx(p => ({ ...p, loaded: true }));
    }
  }

  return (
    <BusinessContext.Provider value={ctx}>
      {children}
    </BusinessContext.Provider>
  );
}
