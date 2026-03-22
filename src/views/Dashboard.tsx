"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDateRange, useDateRangeBounds } from '../contexts/DateRangeContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { STATUS_LABELS } from './dashboard/types';
import { RevenueCard } from './dashboard/RevenueCard';
import { GA4Card } from './dashboard/GA4Card';
import { OrdersCard } from './dashboard/OrdersCard';
import { CampaignsCard } from './dashboard/CampaignsCard';
import { SeoCard } from './dashboard/SeoCard';
import { RecommendationsCard } from './dashboard/RecommendationsCard';
import { useDashboard } from './dashboard/useDashboard';

export function Dashboard() {
  const { dir, language } = useLanguage();
  const { dateRange } = useDateRange();
  const bounds = useDateRangeBounds();
  const { connections, workspaceOwnerName } = useConnections();
  const { format: formatCurrency } = useCurrency();
  const isHebrew = language === 'he';
  const { statusLabels } = { statusLabels: STATUS_LABELS[language as keyof typeof STATUS_LABELS] || STATUS_LABELS.en };

  const {
    isLoadingOverview,
    safeTotalRevenue, safeTotalSpend, safeNetProfit, safeRoas,
    financialAvailability, platformRevenue,
    safeGa4Stats, ga4Users24h, ga4TopPages, isGa4TopPagesDemo,
    hasGa4Data, ga4Availability, ga4LiveAvailability, isGa4UsingDemo,
    safeGscStats, hasGscData, seoAvailability, seoLiveAvailability,
    siteSeoScore, searchConsoleSeoScore, isGscUsingDemo,
    recentOrders, hasOrdersData, isOrdersUsingDemo,
    campaignSummary, hasCampaignData, campaignAvailability, campaignLiveAvailability, isCampaignsUsingDemo,
    optimizationRecommendations, hasAnyOptimizationInput,
    isMetaConnected, isWooConnected, isShopifyConnected, isStoreConnected,
    text,
    goToPath,
  } = useDashboard({
    connections,
    language,
    dateRange,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="ui-display text-2xl sm:text-3xl text-gray-900 dark:text-white">
            {text.title}, {workspaceOwnerName?.split(' ')[0] || 'User'} 👋
          </h1>
          <p className="ui-subtitle text-gray-500 dark:text-gray-400 mt-1">
            {text.subtitle}
          </p>
        </div>
        {isLoadingOverview && (
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {text.syncing}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <RevenueCard
          text={text}
          dir={dir}
          financialAvailability={financialAvailability}
          safeTotalRevenue={safeTotalRevenue}
          safeTotalSpend={safeTotalSpend}
          safeNetProfit={safeNetProfit}
          safeRoas={safeRoas}
          platformRevenue={platformRevenue}
          isMetaConnected={isMetaConnected}
          formatCurrency={formatCurrency}
          onGoOrders={() => goToPath('/orders')}
        />

        <GA4Card
          text={text}
          isHebrew={isHebrew}
          isGa4UsingDemo={isGa4UsingDemo}
          hasGa4Data={hasGa4Data}
          ga4Availability={ga4Availability}
          ga4LiveAvailability={ga4LiveAvailability}
          safeGa4Stats={safeGa4Stats}
          ga4Users24h={ga4Users24h}
          ga4TopPages={ga4TopPages}
          isGa4TopPagesDemo={isGa4TopPagesDemo}
        />

        <OrdersCard
          text={text}
          dir={dir}
          statusLabels={statusLabels}
          isOrdersUsingDemo={isOrdersUsingDemo}
          recentOrders={recentOrders}
          formatCurrency={formatCurrency}
          onGoOrders={() => goToPath('/orders')}
        />

        <CampaignsCard
          text={text}
          dir={dir}
          isCampaignsUsingDemo={isCampaignsUsingDemo}
          campaignSummary={campaignSummary}
          campaignAvailability={campaignAvailability}
          campaignLiveAvailability={campaignLiveAvailability}
          hasCampaignData={hasCampaignData}
          formatCurrency={formatCurrency}
          onGoCampaigns={() => goToPath('/campaigns')}
        />

        <SeoCard
          text={text}
          dir={dir}
          isGscUsingDemo={isGscUsingDemo}
          seoAvailability={seoAvailability}
          seoLiveAvailability={seoLiveAvailability}
          siteSeoScore={siteSeoScore}
          searchConsoleSeoScore={searchConsoleSeoScore}
          safeGscStats={safeGscStats}
          onGoSeo={() => goToPath('/seo')}
        />

        <RecommendationsCard
          text={text}
          dir={dir}
          optimizationRecommendations={optimizationRecommendations}
          hasAnyOptimizationInput={hasAnyOptimizationInput}
          onGoAiRecs={() => goToPath('/ai-recommendations')}
          onGoCampaigns={() => goToPath('/campaigns')}
        />
      </div>
    </div>
  );
}
