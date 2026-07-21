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
            <span className="eyebrow">THE BROKIE MERCH CENTER</span>
            <h1>Control the brand.</h1>
            <p>
              Create, review, feature, archive, and remove merchandise across
              Brokie OS, Printful, Shopify, and thebrokie.com/merch.
            </p>
          </div>
          <div className="heroStatement">
            <span>THE BROKIE</span>
            <strong>TOGETHER WE WIN.</strong>
          </div>
        </header>

        <section className="adminControlStrip" aria-label="Merch control guide">
          <article>
            <span>REVERSIBLE</span>
            <strong>Archive</strong>
            <p>Hide a design or Shopify product without destroying it.</p>
          </article>
          <article>
            <span>STOREFRONT</span>
            <strong>Remove from featured</strong>
            <p>Take an item out of the homepage lineup while keeping the product.</p>
          </article>
          <article className="dangerControl">
            <span>PERMANENT</span>
            <strong>Delete everywhere</strong>
            <p>Remove the Printful sync, Shopify product, and Brokie OS record.</p>
          </article>
        </section>

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
