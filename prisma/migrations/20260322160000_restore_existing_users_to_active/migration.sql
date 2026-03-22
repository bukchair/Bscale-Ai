-- Restore all pre-existing users to active status.
--
-- When the subscriptionStatus column was added (migration 20260322140000),
-- all existing users were assigned the default value 'trial'. Some of them
-- have since been downgraded to 'demo' after the 3-day trial expired.
-- All users in the database at this point are real customers who should
-- have active subscriptions, not trial/demo access.
--
-- New users going forward will correctly start with 'trial'.

UPDATE "User"
SET "subscriptionStatus" = 'active',
    "plan"               = 'pro',
    "trialStartedAt"     = NULL,
    "trialEndsAt"        = NULL
WHERE "subscriptionStatus" IN ('trial', 'demo');
