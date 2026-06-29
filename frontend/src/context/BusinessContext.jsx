import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getUser } from "../utils/auth";

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
    fetchBusinessContext(user);
  }, [user?.user_id]);

  async function fetchBusinessContext(user) {
    try {
      let bizData = null;

      if (user.role === "business_owner") {
        const { data } = await supabase
          .from("businesses")
          .select("industry, scheduling_mode, location_label, staff_label, plan")
          .eq("owner_id", user.user_id)
          .maybeSingle();
        bizData = data;

      } else if (["outlet_manager","regular_staff","outlet_casual_staff"].includes(user.role)) {
        // staff → outlet → business
        const { data: staffRow } = await supabase
          .from("staff")
          .select("outlet_id")
          .eq("user_id", user.user_id)
          .maybeSingle();

        if (staffRow?.outlet_id) {
          const { data: outlet } = await supabase
            .from("outlets")
            .select("business_id")
            .eq("outlet_id", staffRow.outlet_id)
            .maybeSingle();

          if (outlet?.business_id) {
            const { data } = await supabase
              .from("businesses")
              .select("industry, scheduling_mode, location_label, staff_label, plan")
              .eq("business_id", outlet.business_id)
              .maybeSingle();
            bizData = data;
          }
        }
      }

      if (bizData) {
        setCtx({
          industry:       bizData.industry       || "f&b",
          schedulingMode: bizData.scheduling_mode || "shift",
          locationLabel:  bizData.location_label  || "Outlet",
          staffLabel:     bizData.staff_label      || "Staff",
          plan:           bizData.plan             || "free",
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
