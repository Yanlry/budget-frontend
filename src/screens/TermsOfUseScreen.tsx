import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useAppTheme } from '../hooks/useAppTheme';
import { RootStackParamList } from '../navigation/types';

const UPDATED_AT = '25 mai 2026';
const SUPPORT_EMAIL = 'support@simply-rich.com';

export function TermsOfUseScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'TermsOfUse'>) {
  const { theme } = useAppTheme();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={[
            styles.backButton,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.elevated,
            },
          ]}
        >
          <Feather name="chevron-left" size={16} color={theme.colors.text} />
          <Text
            style={[
              styles.backLabel,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.familyMedium,
              },
            ]}
          >
            Retour
          </Text>
        </Pressable>

        <Card>
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyDisplay,
                },
              ]}
            >
              Conditions d utilisation
            </Text>
            <Text
              style={[
                styles.updatedAt,
                {
                  color: theme.colors.textMuted,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              Derniere mise a jour: {UPDATED_AT}
            </Text>
          </View>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              1. Objet
            </Text>
            <Text
              style={[
                styles.body,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              Ces conditions regissent l utilisation de SimplyRich, application de suivi
              budgetaire et de projection financiere personnelle.
            </Text>
          </View>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              2. Compte utilisateur
            </Text>
            <Text
              style={[
                styles.body,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              Tu es responsable de la confidentialite de tes identifiants et des
              actions effectuees depuis ton compte.
            </Text>
          </View>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              3. Usage autorise
            </Text>
            <Text
              style={[
                styles.body,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              L application doit etre utilisee de bonne foi, sans tentative d acces
              non autorise, de fraude ou de perturbation du service.
            </Text>
          </View>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              4. Limitation de responsabilite
            </Text>
            <Text
              style={[
                styles.body,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              Les projections affichees sont indicatives. Elles ne constituent pas un
              conseil financier, juridique ou fiscal.
            </Text>
          </View>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              5. Resiliation
            </Text>
            <Text
              style={[
                styles.body,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              Tu peux cesser d utiliser le service a tout moment et supprimer ton
              compte directement depuis Reglages.
            </Text>
          </View>

          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              6. Contact
            </Text>
            <Text
              style={[
                styles.body,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              Pour toute demande relative a ces conditions, utilise la section
              support dans Reglages ou contacte {SUPPORT_EMAIL}.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 130,
    gap: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  backLabel: {
    fontSize: 13,
  },
  header: {
    gap: 5,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
  },
  updatedAt: {
    fontSize: 12,
  },
  section: {
    gap: 5,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 14,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
  },
});
