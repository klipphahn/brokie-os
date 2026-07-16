import Sidebar from "@/components/sidebar";
import IntegrationCard from "@/components/integration-card";
import BrandDnaPanel from "@/components/brand-dna-panel";
import DesignLibrary from "@/components/design-library";
import AiStudio from "@/components/ai-studio";
import DesignFactoryLoader from "@/components/design-factory-loader";
import Publisher from "@/components/publisher";
import ActivityLog from "@/components/activity-log";
import ShopifyManager from "@/components/shopify-manager";
import StorefrontManager from "@/components/storefront-manager";
import AnalyticsDashboard from "@/components/analytics-dashboard";

export default function HomePage() {
  return (
    <div className="shell">
      <Sidebar />

      <main className="main">
        <header className="hero" id="dashboard">
          <div>
            <span className="eyebrow">THE BROKIE OPERATING SYSTEM</span>
            <h1>Build the brand.</h1>
            <p>
              One command center for artwork, collections, Printful products,
              Shopify drafts, and thebrokie.com/merch.
            </p>
          </div>
          <div className="heroStatement">
            <span>WE DON'T NEED MONEY</span>
            <strong>TO BE DANGEROUS.</strong>
          </div>
        </header>

        <BrandDnaPanel />
        <DesignLibrary />
        <AiStudio />
        <DesignFactoryLoader />
        <Publisher />
        <ShopifyManager />
        <StorefrontManager />
        <AnalyticsDashboard />
        <ActivityLog />

        <section className="panel" id="integrations">
          <div className="panelHead">
            <div>
              <span className="eyebrow">CONNECTION CENTER</span>
              <h2>Integrations</h2>
            </div>
          </div>
          <div className="integrationGrid">
            <IntegrationCard
              title="Printful"
              description="Create synced products and send them to the connected Shopify store."
              endpoint="/api/printful/test"
            />
            <IntegrationCard
              title="Shopify"
              description="Test access to the Shopify Admin GraphQL API."
              endpoint="/api/shopify/test"
            />
            <IntegrationCard
              title="Supabase"
              description="Validate database access for designs, collections, and publishing history."
              endpoint="/api/supabase/test"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
