<script setup lang="ts">
import { onMounted } from 'vue'
import { Button, InputText, Message, Select, Password, Textarea, useToast } from 'primevue'
import { useForm, useFieldArray, type Path } from 'vee-validate'
import * as yup from 'yup'
import { AccountType, useAccountStore } from '@/stores/accountStore'

const accountTypeOptions = Object.entries(AccountType).map(([key, value]) => ({
  value,
  label: key === 'local' ? 'Локальная' : 'LDAP',
}))

const store = useAccountStore()
const toast = useToast()

onMounted(() => {
  console.log('Loaded accounts:', store.accounts)
})

const parseTags = (tagString: string): { text: string }[] => {
  if (!tagString) return []
  return tagString
    .split(';')
    .filter((tag) => tag.trim() !== '')
    .map((tag) => ({ text: tag.trim() }))
}

const schema = yup.object({
  accounts: yup.array().of(
    yup.object({
      tags: yup
        .array()
        .of(
          yup.object({
            text: yup
              .string()
              .max(50, 'Максимум 50 символов для тега')
              .matches(/^[A-Za-z;]+$/, 'Тег может содержать только буквы и символ ;')
              .required('Тег не может быть пустым'),
          }),
        )
        .test('total-length', 'Общая длина тегов не должна превышать 50 символов', (value) => {
          const totalLength = (value || []).reduce((sum, tag) => sum + tag.text.length + 1, -1)
          return totalLength <= 50
        })
        .default([]),
      type: yup.mixed<AccountType>().oneOf(Object.values(AccountType), 'Неверный тип аккаунта'),
      login: yup.string().required('Логин обязателен').max(100, 'Максимум 100 символов'),
      password: yup
        .string()
        .nullable()
        .max(100)
        .when('type', {
          is: (type: AccountType) => type === AccountType.local,
          then: (schema) => schema.required('Пароль обязателен').min(1, 'Пароль обязателен'),
          otherwise: (schema) => schema.nullable().notRequired(),
        }),
      id: yup.string().default(() => crypto.randomUUID()),
    }),
  ),
})

const { values, errors, setFieldValue, validateField, validate } = useForm({
  validationSchema: schema,
  initialValues: { accounts: store.accounts },
})

type FormValues = typeof values

const { fields, push, remove } = useFieldArray('accounts')

const addAccount = () => {
  push({
    type: AccountType.local,
    login: '',
    password: '',
    tags: [],
    id: crypto.randomUUID(),
  })
}

const updateTags = async (value: string | undefined, index: number) => {
  const tagsArray = parseTags(value || '')
  const path = `accounts[${index}].tags` as Path<FormValues>
  await setFieldValue(path, tagsArray)
}

const handleTypeChange = async (value: AccountType, index: number) => {
  const typePath = `accounts[${index}].type` as Path<FormValues>
  const passwordPath = `accounts[${index}].password` as Path<FormValues>
  await setFieldValue(typePath, value)
  if (value === AccountType.ldap) {
    await setFieldValue(passwordPath, '')
  }
  // Сохранение при изменении типа
  await saveOnChange()
}

const updateLogin = async (value: string | undefined, index: number) => {
  const val = value || ''
  const path = `accounts[${index}].login` as Path<FormValues>
  await setFieldValue(path, val)
}

const updatePassword = async (value: string | undefined, index: number) => {
  const val = value || ''
  const path = `accounts[${index}].password` as Path<FormValues>
  await setFieldValue(path, val)
}

// Сохранение при blur
const onBlurField = async (index: number, field: 'login' | 'password' | 'tags') => {
  const path = `accounts[${index}].${field}` as Path<FormValues>
  const { valid } = await validateField(path)
  if (valid) {
    await saveOnChange()
  }
}

// Общая функция сохранения
const saveOnChange = async () => {
  const { valid } = await validate()
  if (valid) {
    const accountsToSave = values.accounts.map((account) => ({
      ...account,
      id: account.id || crypto.randomUUID(),
      password: account.type === AccountType.ldap && !account.password ? null : account.password,
    }))
    store.saveAccounts(accountsToSave)
    console.log('Accounts saved:', store.accounts)
    toast.add({
      severity: 'success',
      summary: 'Сохранено',
    })
  } else {
    console.log('Validation failed:', errors)
  }
}

const deleteAccount = (index: number) => {
  remove(index)
  // Сохранение после удаления
  saveOnChange()
}
</script>

<template>
  <div class="w-full max-w-6xl pt-20">
    <div class="flex gap-4 items-center mb-8">
      <h2 class="text-2xl">Учетные записи</h2>
      <Button @click="addAccount" icon="pi pi-plus" />
    </div>

    <Message class="mb-6" icon="pi pi-question-circle" size="large" severity="secondary">
      Для указания нескольких меток для одной пары логин/пароль используйте разделитель ;
    </Message>

    <form class="">
      <div v-for="(field, index) in fields" :key="field.key" class="flex items-center gap-5 mb-5">
        <Textarea
          class="w-60"
          size="small"
          rows="2"
          cols="30"
          style="resize: none"
          maxlength="50"
          :invalid="Boolean(errors[`accounts[${index}].tags` as Path<FormValues>])"
          :model-value="values.accounts[index].tags?.map((tag) => tag.text).join(';') || ''"
          :onBlur="() => onBlurField(index, 'tags')"
          @value-change="(value) => updateTags(value, index)"
        />

        <Select
          class="w-60"
          :options="accountTypeOptions"
          optionLabel="label"
          optionValue="value"
          size="large"
          :model-value="values.accounts[index].type"
          @value-change="(value) => handleTypeChange(value, index)"
        />

        <div class="grow">
          <InputText
            class="w-full"
            :class="{ 'p-invalid': errors[`accounts[${index}].login` as Path<FormValues>] }"
            placeholder="Логин"
            size="large"
            aria-required
            maxlength="100"
            :model-value="values.accounts[index].login"
            :onBlur="() => onBlurField(index, 'login')"
            @value-change="(value) => updateLogin(value, index)"
          />
        </div>

        <div v-if="values.accounts[index].type === AccountType.local" class="grow">
          <Password
            class="w-full!"
            :invalid="Boolean(errors[`accounts[${index}].password` as Path<FormValues>])"
            type="password"
            placeholder="Пароль"
            size="large"
            aria-required
            maxlength="100"
            :model-value="values.accounts[index].password"
            :onBlur="() => onBlurField(index, 'password')"
            @value-change="(value) => updatePassword(value, index)"
          />
        </div>

        <Button icon="pi pi-trash" @click="deleteAccount(index)" />
      </div>
    </form>

    <pre>{{ errors }}</pre>
  </div>
</template>

<style>
#app .p-inputtext {
  width: 100%;
}
</style>
